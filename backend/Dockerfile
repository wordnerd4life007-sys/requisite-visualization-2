# backend/Dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY Makefile ./
COPY backend ./backend

RUN make api

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /src/build/requisite-api ./requisite-api
COPY backend/data ./backend/data

EXPOSE 8080
ENTRYPOINT ["./requisite-api"]
