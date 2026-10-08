FROM postgres:17-alpine

# Preserve the production database's musl locale behavior while adding pgvector.
ADD https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.1.tar.gz /tmp/pgvector.tar.gz
RUN apk add --no-cache --virtual .pgvector-build build-base \
    && tar -xzf /tmp/pgvector.tar.gz -C /tmp \
    && cd /tmp/pgvector-0.8.1 \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no \
    && rm -rf /tmp/pgvector* \
    && apk del .pgvector-build
