const _ = require('underscore');
const util = require('util');
const consulLib = require('consul');

/**
 * Parses the CONSUL_SERVERS environment variable and chooses a random Consul
 * server to connect to.
 * @returns {Consul} Consul object initialized with server configuration
 */
function consulConnect() {
  if (!process.env.CONSUL_SERVERS) {
    throw new Error('CONSUL_SERVERS must be set');
  }

  const servers = process.env.CONSUL_SERVERS.split(' ');
  const settings = _.shuffle(_.inject(servers, function(memo, item) {
    const params = item.split(':');
    const host = params[0];
    const port = params.length > 1 ? params[1] : 8500;

    memo.push({
      host: host,
      port: port
    });

    return memo;
  }, []));

  return consulLib(settings[0]);
}

var consul = consulConnect();

const serveStatic = require('serve-static');
const compression = require('compression');
const port = process.env.APP_PORT || 5000;
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(compression());
app.use(serveStatic(__dirname + '/app', {'index': ['index.html']}));
app.use('/bower_components', serveStatic(__dirname + '/bower_components'));

const channel = 'messages';
const graph = 'graph';

var services = [];
var nodes = [];
var messageLog = [];

app.get('/update', function (req, res) {
  updateServiceStatus(null);
  res.sendStatus(200);
});

app.get('/messages', function(req, res) {
  res.json(messageLog);
});

app.get('/graph', function(req, res) {
  var data = _.inject(services, function(memo, item) {
    const values = item in nodes ? nodes[item] : [];
    const obj = {};
    obj[item] = values;

    return _.extend(memo, obj);
  }, {});

  res.json(data);
});

function emitMessage(socket, msg) {
  if (socket) {
    socket.broadcast.emit(channel, msg);
    socket.broadcast.emit(graph, msg);
  }
  console.log(msg);
  messageLog.push(msg);
}

const nodeDetails = function(node) {
  return util.format('[name=%s, address=%s]',
    node['Node'], node['Address'])
};

function updateNodeStatus(socket, service) {
  consul.catalog.service.nodes(service, function(err, result) {
    if (err) throw err;

    const nodeKeys = _.map(result, function(item) {
      return item['Node'];
    });

    if (!service in nodes) {
      nodes[service] = [];
    }

    // Nodes Added
    const nodeAddedDiff = _.difference(nodeKeys, nodes[service]);

    if (nodeAddedDiff.length != 0) {
      nodeAddedDiff.forEach(function(item) {

        const node = _.find(result, function(find) {
          return find['Node'] = item;
        });

        if (node) {
          const msg = util.format('[%s] node added %s',
            service, nodeDetails(node));
          emitMessage(socket, msg);
        } else {
          console.error("Couldn't find node in results with name: %s", item);
        }
      });
    }

    // Nodes Added
    const nodeRemovedDiff = _.difference(nodes[service], nodeKeys);

    if (nodeRemovedDiff.length != 0) {
      nodeRemovedDiff.forEach(function(item) {

        const msg = util.format('[%s] node removed [name=%s]',
          service, item);
        emitMessage(socket, msg);
      });
    }

    // Update nodes list if either has changed
    if (nodeAddedDiff.length != 0 || nodeRemovedDiff.length != 0) {
      nodes[service] = nodeKeys;
    }
  });
};

function updateServiceStatus(socket) {
  consul.catalog.service.list( function(err, result) {
    if (err) throw err;

    const serviceKeys = Object.keys(result);
    const serviceAddedDiff = _.difference(serviceKeys, services);
    const serviceRemovedDiff = _.difference(services, serviceKeys);

    // We process the node changes

    _.uniq(_.union(serviceKeys, serviceRemovedDiff)).forEach(function(item) {
      updateNodeStatus(socket, item);
    })

    // Then we process the services added

    if (serviceAddedDiff.length != 0) {
      serviceAddedDiff.forEach(function(item) {
        const msg = util.format('Service added: %s', item);
        emitMessage(socket, msg);
      });
    }

    // Finally, we process the services removed

    if (serviceRemovedDiff.length != 0) {
      serviceRemovedDiff.forEach(function(item) {
        const msg = util.format('Service removed: %s', item);
        emitMessage(socket, msg);
      });
    }

    // Update services list if there have been additions or removals
    if (serviceAddedDiff.length != 0 || serviceRemovedDiff.length != 0) {
      services = serviceKeys;
    }
  });
}

updateServiceStatus(null);

io.on('connection', function(socket, req) {
  setInterval(function() {
    updateServiceStatus(socket);
  }, 1000);

  socket.on(channel, function (msg) {
    io.emit(channel, msg);
  });
});

http.listen(port, function(){
  console.log('Running in: %s', __dirname);
  console.log('Listening on *:%d', port);
});
