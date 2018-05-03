var connectionURL = "http://35.195.187.116/streamengine_12r/signalr";
/*!
 * ASP.NET SignalR JavaScript Library v2.2.2
 * http://signalr.net/
 *
 * Copyright (c) .NET Foundation. All rights reserved.
 * Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
 *
 */

/// <reference path="..\..\SignalR.Client.JS\Scripts\jquery-1.6.4.js" />
/// <reference path="jquery.signalR.js" />
(function ($, window, undefined) {
    /// <param name="$" type="jQuery" />
    "use strict";

    if (typeof ($.signalR) !== "function") {
        throw new Error("SignalR: SignalR is not loaded. Please ensure jquery.signalR-x.js is referenced before ~/signalr/js.");
    }

    var signalR = $.signalR;

    function makeProxyCallback(hub, callback) {
        return function () {
            // Call the client hub method
            callback.apply(hub, $.makeArray(arguments));
        };
    }

    function registerHubProxies(instance, shouldSubscribe) {
        var key, hub, memberKey, memberValue, subscriptionMethod;

        for (key in instance) {
            if (instance.hasOwnProperty(key)) {
                hub = instance[key];

                if (!(hub.hubName)) {
                    // Not a client hub
                    continue;
                }

                if (shouldSubscribe) {
                    // We want to subscribe to the hub events
                    subscriptionMethod = hub.on;
                } else {
                    // We want to unsubscribe from the hub events
                    subscriptionMethod = hub.off;
                }

                // Loop through all members on the hub and find client hub functions to subscribe/unsubscribe
                for (memberKey in hub.client) {
                    if (hub.client.hasOwnProperty(memberKey)) {
                        memberValue = hub.client[memberKey];

                        if (!$.isFunction(memberValue)) {
                            // Not a client hub function
                            continue;
                        }

                        subscriptionMethod.call(hub, memberKey, makeProxyCallback(hub, memberValue));
                    }
                }
            }
        }
    }

    $.hubConnection.prototype.createHubProxies = function () {
        var proxies = {};
        this.starting(function () {
            // Register the hub proxies as subscribed
            // (instance, shouldSubscribe)
            registerHubProxies(proxies, true);

            this._registerSubscribedHubs();
        }).disconnected(function () {
            // Unsubscribe all hub proxies when we "disconnect".  This is to ensure that we do not re-add functional call backs.
            // (instance, shouldSubscribe)
            registerHubProxies(proxies, false);
        });

        proxies['Streaming'] = this.createHubProxy('Streaming');
        proxies['Streaming'].client = { };
        proxies['Streaming'].server = {
            subscribe: function (channels) {
                return proxies['Streaming'].invoke.apply(proxies['Streaming'], $.merge(["Subscribe"], $.makeArray(arguments)));
             },

            unsubscribe: function (channels) {
                return proxies['Streaming'].invoke.apply(proxies['Streaming'], $.merge(["Unsubscribe"], $.makeArray(arguments)));
             }
        };


        return proxies;
    };

    signalR.hub = $.hubConnection(connectionURL, { useDefaultPath: false });
    $.extend(signalR, signalR.hub.createHubProxies());

}(window.jQuery, window));


/*
*here we start the connection and listen to feeds from server and pass
*them to rendering
*/
var livetiming = (function ($, lt) {
    var keyframes = {};

    var kf = ["RaceControlMessages"];

    function init() {
        lt.server.subscribe(kf).done(processData);
    }

    function processData(data) {
        $.each(data, function (k, v) {
            //console.log("key-" + k + "=" + JSON.stringify(v));
            keyframes[k] = v;
        });

        $.each(data, function (k, v) {
            if (k === "Position") { }
            else {
                $(livetiming).trigger("feed", { feedName: k, keyframe: v });
            }
        });
    };

    function GetKeyframe(name) {
        return keyframes[name] || (keyframes[name] = {});
    }

    lt.client.feed = function (feedName, data, timestamp) {
        var keyframe = GetKeyframe(feedName);

        ApplyPatch(keyframe, data);

        $(livetiming).trigger("feed", { feedName: feedName, keyframe: keyframe });
    }

    function ApplyPatch(orig, patch) {
        if (patch._kf) {
            if ($.isArray(orig)) {
                orig.length = 0;
            } else {
                $.each(orig, function (idx, val) { if (idx.substring(0, 1) !== '_') delete orig[idx]; });
            }
            delete patch._kf;
        }
        ApplyPatchChildren(orig, patch);
    }

    function ApplyPatchChildren(orig, patch) {
        $.each(patch, function (name, value) {
            if (name === "_deleted") {
                $.each(patch[name], function (idx, val) { delete orig[val]; });
            } else {
                if (orig[name] !== undefined) {
                    if (typeof value === 'object') {
                        ApplyPatchChildren(orig[name], value);
                    } else {
                        orig[name] = value;
                    }
                } else {
                    orig[name] = value;
                }
            }
        });
    }

    function startStreaming() {
        $.connection.hub.start({ withCredentials: false, reconnectDelay: 5000 }).done(init);
    }

    return {
        start: function () {
            startStreaming();
        }
    };
})(jQuery, $.connection.Streaming);


/*
* Here we listen to the triggered events and write the
* rendering logic here.
*/
var ltscreen = (function ($,livetiming){
    var rcmmsgList = '.rcm-mssg-list > li';
    var rcmmssgWrapper = '.rcm-mssg-list';
    var keyframes = [];

    function GetKeyframe(s) { return keyframes[s];}

    function onData(feedName, keyframe) {
        keyframes[feedName] = keyframe;
        if (feedName === "RaceControlMessages") onRaceControlMessages(keyframe);
    }

    //process the message here
    function onRaceControlMessages(data) {
        var list = "";

        if (data.messages) {
            var newMessagesCount = $(rcmmsgList).length - data.messages.length;
            var newMessages = data.messages.slice(newMessagesCount);
            newMessages.forEach(function(obj, i) {
                list += '<li>';
                list += obj.Category + "   "  + obj.Message;
                list += '</li>';
            });

            $(rcmmssgWrapper).append(list);
        }
    }

    $(livetiming).on("feed", function(event, data) {
          onData(data.feedName, data.keyframe);
    });

    return {
        start: function () {
            console.log('stream starts');
        }
    }
})(jQuery, livetiming);


$(function () {
    livetiming.start();
    ltscreen.start();
});
