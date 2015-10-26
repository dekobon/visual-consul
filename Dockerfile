# dekobon/consul-visualizer:latest
FROM alpine:3.2

MAINTAINER Elijah Zupancic <elijah@zupancic.name>

# Add custom scripts directory
ADD usr /usr

# Add nodejs application
ADD ui /app

# Remove the package list cache from the system because
# we don't need that bloating the image
RUN apk --update add curl bash nodejs grep jq git drill && \
    rm -rf /var/cache/apk/*

# We ditch the default grep in favor of GNU grep because
# we need to do more advanced matching
RUN rm -f /bin/grep && \
    ln -s /usr/bin/grep /bin/grep

# We set the executable bit on all of the newly added scripts
RUN find /usr/local/bin -type f | xargs chmod +x $1

# Upgrade NPM / bower to the latest version
RUN npm install -g npm bower

# Install NPM modules for the application
RUN npm install /app

# Add Bower directory
RUN mkdir -p /app/bower_components

# Add user that will be running the application
RUN adduser -h /app -s /bin/bash -D -u 1337 node

# Change ownership of the application to the runtime user
RUN chown -R node:node /app

# Install client javascript libraries
RUN chmod +wx /app/bower_components && \
    su node -c 'cd /app && bower install /app' && \
    chmod -R -w /app/bower_components

# Add initialization script
COPY init /init

CMD ["/bin/bash", "/init"]
