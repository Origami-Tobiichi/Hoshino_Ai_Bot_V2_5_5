# Gunakan Node.js 22 di atas OS Linux Debian yang paling stabil (bookworm)
# Sangat disarankan untuk mempermudah pemasangan Sharp dan Canvas tanpa kompilasi manual yang abrok
FROM node:22-bookworm

ENV NODE_ENV=development
ENV TZ=Asia/Jakarta
ENV PORT=8000

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
    python3-pip \
    git \
    tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json .npmrc ./

# legacy-peer-deps terbaca dari .npmrc yang ikut ter-copy, biarkan resolve peer bebas
RUN npm install --no-audit --no-fund

# CLI huggingface (`hf`): restore + backup objek sesi untuk Space ephemeral
RUN (python3 -m pip install --break-system-packages huggingface_hub || \
     python3 -m pip install huggingface_hub) || echo "pip skip - persistensi HF tetap jalan lewat GIT_SYNC_URL"

COPY . .

RUN chmod -R 777 /app

CMD ["npm", "start"]
