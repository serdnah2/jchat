window.onload = function () {
    var self = null;
    var Chat = function () {
        self = this;
        this.view = null;
        this.id = null;
        this.username = null;
        this.icon = null;
        this.users = {};
        this.viewMessages = {};
        this.viewUsers = null;
        this.globalMessages = 0;
        this.intervalTime = null;
        this.timeOutTyping = null;
        this.typingCreated = false;
        this.scrollAfterShow = false;
        this.audioNotification = null;
        this.transition = this.checkTransition();
        this.socket = io.connect("http://jchatserver-serdnah2.rhcloud.com/", {'sync disconnect on unload': true});

    };

    Chat.prototype.sizeObj = function (obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key))
                size++;
        }
        return size;
    };

    Chat.prototype.checkTransition = function () {
        var obj = document.createElement('div');
        var alltransitions = {
            'transition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'MozTransition': 'transitionend',
            'WebkitTransition': 'webkitTransitionEnd',
            'MsTransition': 'msTransitionEnd'
        };
        for (var t in alltransitions) {
            if (obj.style[t] !== undefined) {
                return alltransitions[t];
            }
        }
    };
    Chat.prototype.uniqueid = function () {
        var idstr = String.fromCharCode(Math.floor((Math.random() * 25) + 65));
        do {
            var ascicode = Math.floor((Math.random() * 42) + 48);
            if (ascicode < 58 || ascicode > 64) {
                idstr += String.fromCharCode(ascicode);
            }
        } while (idstr.length < 32);
        this.id = idstr;
        return (this.id);
    };

    Chat.prototype.listeners = function () {
        $(window).resize(function () {
            self.checkView();
        });

        $('#icon-view-users').click(function () {
            $('.container-user').removeClass('selected');
            $('#icon-view-users').fadeOut();
            $('#container-new-messages').fadeOut();
            $('#header-title').fadeOut('fast', function () {
                $('#header-title').html('').text('jChat - ' + self.username);
                $('#header-title').fadeIn();
            });
            setTimeout(function () {
                $('#container-message').removeClass('translate');
                $('#container-message').removeClass('open');
                if (self.transition !== undefined) {
                    $('#container-message').bind(self.transition, function () {
                        $('#container-message').unbind(self.transition);
                        $('.message-private').hide();
                        window.scrollTo(0, 0);
                    });
                } else {
                    $('.message-private').hide();
                    window.scrollTo(0, 0);
                }
            }, 100);
        });

        $('.container-user').live('click', function () {
            var id = $(this).attr('data-id');
            $('.container-user').removeClass('selected');
            $(this).addClass('selected');
            $(this).find('.total-message').css('opacity', '0');
            self.showMessages(id);

            var totalUserMessages = $(this).find('.total-message').text();
            if (totalUserMessages !== '') {
                $(this).find('.total-message').text('');
                self.globalMessages = (parseInt(self.globalMessages) - parseInt(totalUserMessages));
                if (self.globalMessages > 0) {
                    $('#new-messages-back').text(self.globalMessages);
                    $('title').text('(' + self.globalMessages + ') jChat');
                } else {
                    $('#new-messages-back').text('');
                    $('title').text('jChat');
                }
            }
        });

        $('#container-new-messages form').submit(function (e) {
            e.preventDefault();
            var userId = $('.container-user.selected').attr('data-id');
            var msg = self.strip_tags($('#form-new-message input').val());
            if (msg !== '') {
                $('#form-new-message input').val('');
                var data = {
                    userId: userId,
                    msg: msg,
                    date: moment().fromNow(),
                    newDate: moment().format()
                };
                self.createNewMessage(data, true);
                self.socket.emit("privateMessage", data);
                $('#' + userId + ' .viewed, [data-id="' + userId + '"] .viewed').removeClass('visible');
                if (self.typingCreated) {
                    self.typingEvent();
                    self.typingCreated = false;
                }
            }
        });

        $('.select-gender').click(function () {
            $('.selected').removeClass('selected');
            $(this).addClass('selected');
        });

        $('#container-form-username form').submit(function (e) {
            e.preventDefault();
            var newUserName = $('#container-form-username form input').val();
            if ($('.select-gender.selected').length > 0) {
                var icon = $('.select-gender.selected').attr('data-icon');
                if (newUserName !== "" && newUserName !== null) {
                    self.socket.emit('checkUsername', {
                        id: self.id,
                        username: newUserName,
                        icon: icon
                    });
                }
            }
        });

        $('#form-new-message input').keypress(function (e) {
            if (e.which != 13) {
                if (!self.typingCreated) {
                    self.typingCreated = true;
                    self.typingEvent();
                }
                clearTimeout(self.timeOutTyping);
                self.timeOutTyping = setTimeout(function () {
                    if (self.typingCreated) {
                        self.typingEvent();
                        self.typingCreated = false;
                    }
                }, 400);
            }
        });
    };

    Chat.prototype.typingEvent = function () {
        var userId = $('.container-user.selected').attr('data-id');
        this.socket.emit('typing', {
            userId: userId,
            tipyng: this.typingCreated
        });
    };

    Chat.prototype.listenerSocket = function () {
        this.socket.on("checkUsername", function (exist, user) {
            if (!exist) {
                self.username = user.username;
                self.icon = user.icon;
                self.socket.emit('online', {
                    id: self.id,
                    username: self.username,
                    icon: self.icon
                });
            } else {
                alert('user exist');
            }
        });

        this.socket.on("allUsersOnline", function (users) {
            self.showChatView();
            self.listenerSocketNewUserOnline();
            self.users = users;
            if (self.sizeObj(users) <= 1) {
                $('#no-users-online').addClass('visible');
            } else {
                $('#no-users-online').removeClass('visible');
                for (var i in users) {
                    if (self.id !== users[i].id) {
                        self.createViewMessage(users[i]);
                    }
                }
            }
            $('#header-title').fadeOut('fast', function () {
                $('#header-title').text('jChat - ' + self.username);
                $('#header-title').fadeIn('fast');
            });
        });

        this.socket.on("privateMessage", function (dataMsg) {
            self.createNewMessage(dataMsg);
        });

        this.socket.on("typing", function (data) {
            $('#' + data.userId + ' .typing, [data-id="' + data.userId + '"] .typing').toggleClass('visible');
        });

        this.socket.on("viewed", function (data) {
            $('#' + data.userId + ' .viewed, [data-id="' + data.userId + '"] .viewed').addClass('visible');
        });

        this.socket.on("offline", function (user) {
            self.offlineUser(user);
            delete self.users[user.id];
            delete self.viewMessages[user.id];
        });

        this.socket.on('offlinebyinnactive', function () {
            $('#offlineOver').show();
            $('form input').blur();
            alert('You are offline, please reload page');
        });
    };

    Chat.prototype.listenerSocketNewUserOnline = function () {
        this.socket.on("newUserOnline", function (user) {
            $('#no-users-online').removeClass('visible');
            self.createViewMessage(user);
        });
    };

    Chat.prototype.showChatView = function () {
        $('#enter-username').fadeOut();
    };

    Chat.prototype.offlineUser = function (user) {
        $('#' + user.id).addClass('offline');
        $('#container-new-messages').fadeOut('fast');
        $('[data-id="' + user.id + '"]').parent().addClass('offline');
        if (this.transition !== undefined) {
            $('[data-id="' + user.id + '"]').parent().bind(this.transition, function () {
                $('.wrapper-user.offline').remove();
            });
        } else {
            $('.wrapper-user.offline').remove();
        }
    };

    Chat.prototype.createViewMessage = function (user) {
        $.new_user = '\
            <div class="wrapper-user">\
                <div class="container-user dt" data-id="' + user.id + '">\
                <div class="container-picture-user dtc">\
                    <img src="img/faces/' + user.icon + '.png" alt="picture"/>\
                    <div class="total-message"></div>\
                </div>\
                <div class="container-info-user dtc">\
                    <div class="current-time"></div>\
                    <div class="container-info-user-name">' + user.username + '</div>\
                    <div class="container-info-user-lates-message">No messages</div>\
                    <div class="container-typing">\
                    <div class="typing">typing...</div>\
                    <div class="viewed">\
                        <i class="fa fa-check"></i>\
                    </div>\
                </div>\
                </div>\
            </div></div>';

        $.new_view_message = '\
            <div id="' + user.id + '" class="message-private hide">\
            <div class="scroller-down hide">New message, slide down</div>\
                <div class="message-private-container-scroll">\
                    <div class="wrapperScroll">\
                        <div class="scroller"></div>\
                    </div>\
                </div>\
                <div class="container-typing">\
                    <div class="typing">\
                        <i class="fa fa-circle"></i>\
                        <i class="fa fa-circle"></i>\
                        <i class="fa fa-circle"></i>\
                    </div>\
                    <div class="viewed">\
                        <i class="fa fa-check"></i>\
                    </div>\
                </div>\
            </div>';
        $("#container-message").append($.new_view_message);
        $("#container-users-online .scroller").append($.new_user);

        var opt = {
            scroll: new IScroll('#' + user.id + ' .wrapperScroll', {
                click: true,
                scrollbars: true,
                mouseWheel: true,
                shrinkScrollbars: 'scale',
                fadeScrollbars: true
            }),
            id: user.id,
            newMessage: false
        };

        this.viewMessages[user.id] = opt;
        this.viewUsers.refresh();
        this.viewMessages[user.id].scroll.on('scrollEnd', function () {
            if (Math.abs(this.maxScrollY) - Math.abs(this.y) < 10) {
                if (self.viewMessages[user.id].newMessage) {
                    self.viewMessages[user.id].newMessage = false;
                    var messageView = $('#' + user.id + ' .scroller-down');
                    if (messageView.is(':visible')) {
                        messageView.fadeOut();
                        self.viewedMessage();
                    }
                }
            }
        });
    };

    Chat.prototype.createNewMessage = function (dataMsg, client) {
        if (client) {
            $.new_message = '\
            <ul class="chat-box">\
                <li class="arrow-box-right gray">\
                <div class="avatar">\
                <img class="avatar-small img-circle" src="img/faces/' + this.icon + '.png">\
                </div>\
                ' + dataMsg.msg + '\
                </li>\
             </ul>';
            $('#' + dataMsg.userId + ' .scroller').append($.new_message);
            $('[data-id="' + dataMsg.userId + '"] .container-info-user-lates-message').html('').text('You: ' + dataMsg.msg);
            $('[data-id="' + dataMsg.userId + '"] .current-time').html('').text(dataMsg.date).data('newDate', dataMsg.newDate);
            this.viewMessages[dataMsg.userId].scroll.refresh();
            this.viewMessages[dataMsg.userId].scroll.scrollToElement("ul:last-child");
        } else {
            this.viewMessages[dataMsg.user.id].newMessage = true;
            var scroll = this.viewMessages[dataMsg.user.id].scroll;
            $.new_message = '\
            <ul class="chat-box">\
                <li class="arrow-box-left">\
                <div class="avatar">\
                <img class="avatar-small img-circle" src="img/faces/' + dataMsg.user.icon + '.png">\
                </div>\
                ' + dataMsg.msg + '\
                </li>\
             </ul>';
            $('#' + dataMsg.user.id + ' .scroller').append($.new_message);
            $('[data-id="' + dataMsg.user.id + '"] .container-info-user-lates-message').html('').text(dataMsg.msg);
            $('[data-id="' + dataMsg.user.id + '"] .current-time').html('').text(dataMsg.date).data('newDate', dataMsg.newDate);
            if (!$('#' + dataMsg.user.id).is(':visible')) {
                var totalMessages = $('[data-id="' + dataMsg.user.id + '"] .total-message').data('total');
                totalMessages === undefined ? totalMessages = 0 : 0;
                if (parseInt($('[data-id="' + dataMsg.user.id + '"] .total-message').css('opacity')) === 0) {
                    totalMessages = 0;
                }
                totalMessages += 1;
                $('[data-id="' + dataMsg.user.id + '"] .total-message').data('total', totalMessages).text(totalMessages);
                $('[data-id="' + dataMsg.user.id + '"] .total-message').css('opacity', '1');

                this.globalMessages = 0;
                $('.total-message').each(function () {
                    var totalUserMessages = $(this).html();
                    if (totalUserMessages !== '') {
                        self.globalMessages = (parseInt(self.globalMessages) + parseInt(totalUserMessages));
                    }
                });
                $('#new-messages-back').text(this.globalMessages);
                $('title').text('(' + this.globalMessages + ') jChat');
                this.audioNotification.play();
                if (Math.abs(scroll.maxScrollY) - Math.abs(scroll.y) < 10) {
                    this.scrollAfterShow = true;
                } else {
                    this.scrollAfterShow = false;
                }
            } else {
                if (Math.abs(scroll.maxScrollY) - Math.abs(scroll.y) < 10) {
                    scroll.refresh();
                    scroll.scrollToElement("ul:last-child");
                    this.viewedMessage();
                } else {
                    this.showScrollMessage(dataMsg.user.id);
                }
            }
        }
    };

    Chat.prototype.showMessages = function (id) {
        $('.message-private').hide();
        $('#' + id).show();
        $('.message-private.offline').remove();

        if (this.view === 'mobile') {
            $('#icon-view-users').fadeIn();
        }

        $('#header-title').fadeOut('fast', function () {
            var username = $('[data-id="' + id + '"] .container-info-user-name').text();
            $('#header-title').html('').text(username);
            $('#header-title').fadeIn();
        });
        if (!$('#container-message').hasClass('open')) {
            if (!$('#container-message').is(':visible')) {
                $('#container-message').show();
            }
            setTimeout(function () {
                $('#container-message').addClass('translate');
                $('#container-message').addClass('open');
                if (this.transition !== undefined) {
                    $('#container-message').bind(this.transition, function () {
                        $('#container-message').unbind(this.transition);
                        $('#container-new-messages').fadeIn();
                        self.showScrollMessage(id);
                    });
                } else {
                    $('#container-new-messages').fadeIn();
                    self.showScrollMessage(id);
                }
            }, 100);
        } else {
            if (!$('#container-new-messages').is(':visible')) {
                $('#container-new-messages').fadeIn();
            }
            this.showScrollMessage(id);
        }
    };

    Chat.prototype.showScrollMessage = function (id) {
        var scroll = this.viewMessages[id].scroll;
        scroll.refresh();
        if (this.viewMessages[id].newMessage && ((scroll.scrollerHeight - scroll.wrapperHeight) > 0)) {
            if (!this.scrollAfterShow) {
                $('#' + id + ' .scroller-down').fadeIn();
            } else {
                scroll.scrollToElement("ul:last-child");
                this.scrollAfterShow = false;
                this.viewedMessage();
            }
        } else {
            if (this.viewMessages[id].newMessage) {
                this.viewedMessage();
            }
        }
    };

    Chat.prototype.updateTime = function () {
        $(".current-time").each(function () {
            var time = $('.current-time').data('newDate');
            if (time !== undefined && time !== '' && time !== null) {
                var currentDate = $(this).data('newDate');
                $(this).text(moment(currentDate).fromNow());
                console.log('enter to update time');
            }
        });
    };

    Chat.prototype.strip_tags = function (input, allowed) {
        // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
        allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');
        var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
                commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
        return input.replace(commentsAndPhpTags, '')
                .replace(tags, function ($0, $1) {
                    return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
                });
    };

    Chat.prototype.checkView = function () {
        var viewScreen = ($('body').width() < 700) ? 'mobile' : 'full';
        this.view = viewScreen;
        if (($('#container-message').hasClass('open')) && this.view === 'mobile') {
            $('#icon-view-users').show();
        }
    };

    Chat.prototype.viewedMessage = function () {
        var idUser = $('.container-user.selected').attr('data-id');
        self.socket.emit('viewed', idUser);
    };

    Chat.prototype.audio = function () {
        this.audioNotification = new Audio();
        this.audioNotification.src = 'audio/newMessage.mp3';
        this.audioNotification.preload = true;
    };

    Chat.prototype.init = function () {
        this.uniqueid();
        this.audio();
        this.checkView();
        this.listeners();
        this.listenerSocket();
        this.updateTime();
        this.viewUsers = new IScroll('#container-users-online .wrapperScroll', {
            click: true,
            scrollbars: true,
            mouseWheel: true,
            shrinkScrollbars: 'scale',
            fadeScrollbars: true
        });
        this.intervalTime = setInterval(function () {
            self.updateTime();
        }, 60000);
    };

    var jchat = new Chat();
    jchat.init();
};