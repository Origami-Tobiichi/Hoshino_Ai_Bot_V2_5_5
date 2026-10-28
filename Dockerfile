# Gunakan Node.js 22 di atas OS Linux Debian yang paling stabil (bookworm)
# Sangat disarankan untuk mempermudah pemasangan Sharp dan Canvas tanpa kompilasi manual yang abrok
FROM node:22-bookworm

ENV NODE_ENV=development
ENV TZ=Asia/Jakarta

WORKDIR /app

# Update package manager dan instal dependencies fundamental OS:
# - ffmpeg (Untuk bikin stiker video/audio)
# - libvips-dev (Dukungan penuh untuk library sharp jika butuh recompile)
# - build-essential (Untuk modul native C++ jika ada)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    libvips-dev \
    build-essential \
    python3 \
    git \
    tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json ./

RUN npm install

COPY . .

RUN chmod -R 777 /app

CMD ["npm", "start"]
