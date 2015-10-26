/* Custom shape render for service representation on graph. */
var renderService = function(r, n) {
  var frame = r.rect(n.point[0] - 30, n.point[1] - 13, 60, 44);
  frame.attr({
    fill: '#feb', r: 12,
    'stroke-width': (n.distance === 0 ? '3px' : '1px')
  });
  /* the Raphael set is obligatory, containing all you want to display */
  var set = r.set().push(frame,
    /* custom objects go here */
    r.text(n.point[0], n.point[1] + 10, (n.label || n.id))
  );
  return set;
};

/* Reference to web socket. */
var socket;
/* Reference to clean clone of the canvas div. */
var cleanCanvas;

/* Redraw the Consul graph on the browser. */
const updateGraph = function() {
  $.getJSON("/graph", function (data) {
    var g = new Graph();
    var layouter = new Graph.Layout.Spring(g);

    $("#graph").replaceWith(cleanCanvas.clone());

    var width = $('#graph').width() > 10 ?
      $('#graph').width() - 10: $('#graph').width();

    var renderer = new Graph.Renderer.Raphael('graph',
      g, width, $('#graph').height());

    $.each(data, function (key, val) {
      g.addNode('[' + key + ']', { label: key, render: renderService });

      $.each(val, function (idx, item) {
        g.addEdge('[' + key + ']', item);
      });
    });

    layouter.layout();
    renderer.draw();
  });
};

/* When we resize the window, we need to keep the graph sane, so we redraw. */
$(window).resize(function() {
  updateGraph();
});

// Wait until document has loaded to start doing socket.io operations
$(document).ready(function() {
  cleanCanvas = $("#graph").clone();
  $.getJSON("/update", function() { });
  const channel = 'messages';

  /* Load latest log messages from endpoint because we probably didn't get
   * them real-time from web sockets.
   */
  const updateLog = function() {
    if ($('#messages').length == 1) {
      $.getJSON("/messages", function(data) {
        if (data.length > 1) {
          for (var i = 0; i < data.length; i++) {
            $('#messages').append($('<li>').text(data[i]));
          }

          return data.length;
        } else {
          return 0;
        }
      });
    }

    return $('#messages').length;
  };

  /* Attempt to retry loading until the messages have been loaded. */
  var updateCount = 0;
  while (updateLog() < 1 && updateCount < 3) {
    setTimeout(function() {}, 2000);
    updateCount++;
  }

  /* Update the graph on the first load. */
  updateGraph();

  /* Start listening on web socket for any new status change messages from
   * Consul. */
  if (!socket) {
    socket = io();

    console.log("Listening for changes to Consul services");

    socket.on(channel, function (msg) {
      $('#messages').append($('<li>').text(msg));
      updateGraph();
    });
  }
});
