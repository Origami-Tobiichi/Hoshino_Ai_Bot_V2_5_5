# Node 22 di Debian bookworm. Diminimalkan agar image < 1 GiB terkompresi
# (limit upload image pada tier free Koyeb).
FROM node:22-bookworm

ENV NODE_ENV=development
ENV TZ=Asia/Jakarta
ENV PORT=8000
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Runtime saja: ffmpeg (media), git (persist via GIT_SYNC_URL), tzdata.
# TIDAKADA: build-essential/libvips-dev (semua modul native pakai prebuild x64),
#           python3/pip (backend HF dataset opsional; backend GIT cukup git).
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg git tzdata ca-certificates && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package.json .npmrc ./

# legacy-peer-deps dibaca dari .npmrc; cache dibuang.
# tanpa `npm prune`: transitive deps dari paket file:./hsnai ikut terpasang
RUN npm install --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf ~/.npm /tmp/*

COPY . .

# deps milik package vendored hsnai (requirements crypto/store/cache-manager dll.)
# harus SETELAH COPY (folder hsnai baru ikut) supaya `cd hsnai` valid
RUN chmod -R 777 /app || true

RUN cd hsnai && npm install --omit=dev --no-audit --no-fund --legacy-peer-deps && \
    npm cache clean --force && cd ..

CMD ["npm", "start"]
