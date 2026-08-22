/**
 * SNWebRTC spatial bridge — OWNER LAW 2026-08-17
 * A call is a glowing great-circle on the globe + two lit pins.
 * Room-code modal is secondary; media may run, depiction is space.
 * Build: 20260817120500-webrtc-space
 */
(function (global) {
  'use strict';
  var BUILD = '20260817120500-webrtc-space';
  var activeLinkId = null;

  function log(m, c) {
    try {
      if (global.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 200), c || 'ok', true);
    } catch (_) {}
  }

  function peerFromOpts(opts, order) {
    opts = opts || {};
    if (opts.peerLat != null && opts.peerLng != null) {
      return { lat: Number(opts.peerLat), lng: Number(opts.peerLng), label: opts.label };
    }
    if (order) {
      var lat =
        order.vendor_lat != null
          ? order.vendor_lat
          : order.drop_lat != null
            ? order.drop_lat
            : order.lat;
      var lng =
        order.vendor_lng != null
          ? order.vendor_lng
          : order.drop_lng != null
            ? order.drop_lng
            : order.lng;
      if (lat != null)
        return {
          lat: Number(lat),
          lng: Number(lng),
          label: order.vendorName || order.clientName || opts.label,
        };
    }
    return null;
  }

  function paintCall(order, opts) {
    if (!global.SNSpaceLinks || !SNSpaceLinks.addCall) return null;
    var peer = peerFromOpts(opts, order);
    if (!peer) {
      log('Call media open · add peer place for globe arc (call athens)', 'dim');
      return null;
    }
    try {
      if (activeLinkId) SNSpaceLinks.remove(activeLinkId);
    } catch (_) {}
    activeLinkId = SNSpaceLinks.addCall(peer, {
      id: opts && opts.spaceLinkId,
      label: (opts && opts.label) || peer.label || 'Call',
      labelB: (opts && opts.label) || peer.label || 'PEER',
      from: opts && opts.from,
    });
    return activeLinkId;
  }

  function dimCall() {
    if (!activeLinkId || !global.SNSpaceLinks) return;
    try {
      SNSpaceLinks.setLive(activeLinkId, false);
      setTimeout(function () {
        try {
          if (global.SNSpaceLinks) SNSpaceLinks.remove(activeLinkId);
        } catch (_) {}
        activeLinkId = null;
      }, 2200);
    } catch (_) {
      activeLinkId = null;
    }
  }

  function hook() {
    var W = global.SNWebRTC;
    if (!W || W._spaceHooked) return;
    W._spaceHooked = true;

    var prevStart = W.startCall && W.startCall.bind(W);
    if (prevStart) {
      W.startCall = function (order, opts) {
        opts = opts || {};
        paintCall(order, opts);
        try {
          var layer = document.getElementById('sn-rtc-layer');
          if (layer && opts.spaceFirst !== false) {
            setTimeout(function () {
              try {
                if (layer.classList.contains('on') && W.inCall) layer.classList.add('min');
              } catch (_) {}
            }, 400);
          }
        } catch (_) {}
        return prevStart(order, opts);
      };
    }

    var prevInstant = W.startInstant && W.startInstant.bind(W);
    if (prevInstant) {
      W.startInstant = function (opts) {
        opts = opts || {};
        if (!opts.peerLat && !opts.place) {
          log('Prefer: call <city> · paints great-circle on globe', 'dim');
        }
        return prevInstant(opts);
      };
    }

    var prevHang = W.hangup && W.hangup.bind(W);
    if (prevHang) {
      W.hangup = function (silent) {
        dimCall();
        return prevHang(silent);
      };
    }

    W.paintSpace = paintCall;
    W.dimSpace = dimCall;
    W.spaceLinkId = function () {
      return activeLinkId;
    };

    log('WebRTC · spatial bridge ON · call = globe arc + pins', 'dim');
  }

  function init() {
    hook();
    var n = 0;
    var t = setInterval(function () {
      n++;
      hook();
      if ((global.SNWebRTC && global.SNWebRTC._spaceHooked) || n > 40) clearInterval(t);
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 300);
    });
  } else {
    setTimeout(init, 300);
  }

  global.SNWebRTCSpace = { build: BUILD, init: init, paintCall: paintCall, dimCall: dimCall };
})(typeof window !== 'undefined' ? window : globalThis);
