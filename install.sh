#!/usr/bin/env bash

W='\033[1;37m'
G='\033[1;32m'
R='\033[1;31m'
Y='\033[1;33m'
C='\033[1;36m'
P='\033[1;35m'
DIM='\033[2m'
NC='\033[0m'
CLR='\033[K'

LOGDIR="${TMPDIR:-${PREFIX:-/usr}/tmp}"
LOGFILE="$LOGDIR/hoshino_install.log"
> "$LOGFILE"

clear

echo -e "${P}"
cat << "EOF"
  ██████╗ ██╗   ██╗██████╗ ██╗███╗   ██╗    ███╗   ███╗██████╗ 
 ██╔═══██╗██║   ██║██╔══██╗██║████╗  ██║    ████╗ ████║██╔══██╗
 ██║   ██║██║   ██║██████╔╝██║██╔██╗ ██║    ██╔████╔██║██║  ██║
 ██║   ██║██║   ██║██╔══██╗██║██║╚██╗██║    ██║╚██╔╝██║██║  ██║
 ╚██████╔╝╚██████╔╝██║  ██║██║██║ ╚████║    ██║ ╚═╝ ██║██████╔╝
  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝    ╚═╝     ╚═╝╚═════╝
EOF
echo -e "${NC}"
echo -e "  ${DIM}Auto Installer v2.4.0${NC}"
echo ""

run_task() {
    local label="$1"
    shift
    local cmd="$@"
    local frames='|/-\'
    local pct=0
    local i=0

    eval "$cmd" >> "$LOGFILE" 2>&1 &
    local pid=$!

    while kill -0 $pid 2>/dev/null; do
        local f=${frames:i%4:1}
        if [ $pct -lt 95 ]; then
            pct=$((pct + RANDOM % 5 + 1))
            [ $pct -gt 95 ] && pct=95
        fi
        printf "\r${CLR}  ${Y}${f}${NC}  ${W}%-36s${NC} ${C}%3d%%${NC}" "$label" "$pct" 2>/dev/null
        sleep 0.3
        i=$((i + 1))
    done

    wait $pid
    local code=$?

    if [ $code -eq 0 ]; then
        printf "\r${CLR}  ${G}✓${NC}  ${W}%-36s${NC} ${G}100%%${NC}\n" "$label"
    else
        printf "\r${CLR}  ${Y}!${NC}  ${W}%-36s${NC} ${Y}warn${NC}\n" "$label"
    fi

    return $code
}

check_tool() {
    local cmd="$1"
    local name="$2"
    if command -v "$cmd" &> /dev/null; then
        local ver=$($cmd --version 2>/dev/null | head -1)
        echo -e "  ${G}✓${NC}  ${W}${name}${NC} ${DIM}${ver}${NC}"
    else
        echo -e "  ${R}✗${NC}  ${W}${name} tidak ditemukan!${NC}"
    fi
}

echo -e "  ${W}Mengecek OS kamu...${NC}"
echo ""

if command -v pkg &> /dev/null; then
    echo -e "  ${G}✓${NC}  ${W}Terdeteksi: ${C}Termux (Android)${NC}"
    echo ""

    run_task "Update & upgrade Termux" "yes | pkg update && yes | pkg upgrade"
    run_task "Instal semua package" "yes | pkg install nodejs ffmpeg git python clang binutils build-essential libvips"

    echo ""
    check_tool "node" "Node.js"
    check_tool "ffmpeg" "FFmpeg"
    check_tool "git" "Git"
    check_tool "clang" "Clang"

    export CC=clang
    export CXX=clang++

elif command -v apt-get &> /dev/null; then
    echo -e "  ${G}✓${NC}  ${W}Terdeteksi: ${C}Ubuntu / Debian${NC}"
    echo ""

    run_task "Update repository apt" "sudo apt-get update -y"
    run_task "Instal semua package" "sudo apt-get install -y ffmpeg git build-essential python3 curl libvips-dev"

    if ! command -v node &> /dev/null; then
        run_task "Setup repo Node.js 22" "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
        run_task "Instal Node.js" "sudo apt-get install -y nodejs"
    fi

    echo ""
    check_tool "node" "Node.js"
    check_tool "ffmpeg" "FFmpeg"
    check_tool "git" "Git"

elif command -v pacman &> /dev/null; then
    echo -e "  ${G}✓${NC}  ${W}Terdeteksi: ${C}Arch Linux${NC}"
    echo ""

    run_task "Update sistem" "sudo pacman -Syu --noconfirm"
    run_task "Instal semua package" "sudo pacman -S --noconfirm nodejs npm ffmpeg git base-devel python vips"

    echo ""
    check_tool "node" "Node.js"
    check_tool "ffmpeg" "FFmpeg"
    check_tool "git" "Git"
else
    echo -e "  ${R}✗${NC}  ${W}OS tidak dikenali, instal manual ya.${NC}"
    exit 1
fi

IS_TERMUX=false
if command -v pkg &> /dev/null; then
    IS_TERMUX=true
fi

echo ""
echo -e "  ${W}Mulai npm install, agak lama ya sabar...${NC}"
echo ""

run_task "Download semua module bot" "npm install --ignore-scripts"
NPM_EXIT=$?

if [ $NPM_EXIT -ne 0 ]; then
    echo ""
    echo -e "  ${R}✗${NC}  ${W}npm install gagal. Error terakhir:${NC}"
    echo ""
    tail -15 "$LOGFILE" 2>/dev/null
    echo ""
    echo -e "  ${DIM}Log: $LOGFILE${NC}"
    echo ""
    exit 1
fi

if [ "$IS_TERMUX" = true ]; then
    run_task "Build sharp (android-arm64)" "npm rebuild sharp --build-from-source"
else
    run_task "Build native modules" "npm rebuild --build-from-source"
fi

echo ""
echo -e "  ${G}✓${NC}  ${W}Semua module berhasil di-install${NC}"

echo ""
echo -e "  ╭─────────────────────────────────────╮"
echo -e "  │  ${W}Mau langsung jalankan bot?${NC}          │"
echo -e "  │                                     │"
echo -e "  │  ${C}1${NC}  ${W}Langsung${NC} ${Y}npm start${NC}              │"
echo -e "  │  ${C}2${NC}  ${W}Edit${NC} ${C}config.js${NC} ${W}dulu${NC}            │"
echo -e "  │                                     │"
echo -e "  ╰─────────────────────────────────────╯"
echo ""
printf "  ${W}Pilih [${C}1${W}/${C}2${W}]: ${NC}"
read -r PILIHAN

case "$PILIHAN" in
    1)
        echo ""
        echo -e "  ${G}▶${NC}  ${W}Menjalankan bot...${NC}"
        echo ""
        npm start
        ;;
    2)
        echo ""
        echo -e "  ${G}✓${NC}  ${W}Silahkan edit ${C}config.js${W} dulu${NC}"
        echo -e "  ${DIM}     Ketik: nano config.js${NC}"
        echo -e "  ${DIM}     Kalau sudah, jalankan: npm start${NC}"
        echo ""
        ;;
    *)
        echo ""
        echo -e "  ${G}✓${NC}  ${W}Silahkan edit ${C}config.js${W} dulu, terus ketik ${Y}npm start${NC}"
        echo ""
        ;;
esac
