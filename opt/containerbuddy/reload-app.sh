#!/bin/bash

# get all the health application servers and write the json to file
curl -s http://165.225.168.222:8500/v1/health/service/app?passing | json > /tmp/lastQuery.json

cat <<EOF > /srv/index.html
<html>
<head>
<title>Containerbuddy Demo</title>
<script>
function timedRefresh(timeoutPeriod) {
    setTimeout("location.reload(true);",timeoutPeriod);
}
</script>
</head>
<body onload="JavaScript:timedRefresh(5000);">
<h1>Containerbuddy Demo</h1>
<h2>This page served by app server: $(hostname)</h2>
Last service health check changed at $(date):
<pre>
$(cat /tmp/lastQuery.json)
</pre>
<script>
</body><html>
EOF
