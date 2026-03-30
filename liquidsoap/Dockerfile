FROM savonet/liquidsoap:v2.4.2

USER root
RUN mkdir -p /var/lib/apt/lists/partial && \
    apt-get update -qq && \
    apt-get install -y -qq --no-install-recommends curl awscli && \
    rm -rf /var/lib/apt/lists/*
USER liquidsoap
