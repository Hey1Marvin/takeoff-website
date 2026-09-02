#!/usr/bin/env bash
# ============================================================
# Instagram-Reels → web-taugliche Medien in app/public/media/
#
# Das Rohmaterial in InstaReels/ bleibt lokal (gitignoriert). Hier
# entstehen daraus die Fassungen, die ins Repo gehen.
#
# Warum je Gruppe andere Einstellungen: die 23 Mitschnitte aus der
# Menge machen den Löwenanteil aus und tragen wenig Detail — sie
# werden am stärksten gefasst. Wortbeiträge brauchen dagegen Ton und
# ein lesbares Gesicht, animierte Teaser scharfe Kanten.
#
# Nur mp4/H.264 — universell unterstützt. webm zusätzlich NUR fürs
# Hero-Video: dort läuft die Datei dauerhaft im Hintergrund, da lohnt
# das zweite Format. Für eine Galerie wuerde es die Ablage verdoppeln,
# ohne dass es jemand sieht.
#
# ffmpeg braucht -nostdin: ohne das liest es aus der Standardeingabe und
# verschluckt die restlichen Zeilen der Zuordnungstabelle, durch die die
# umgebende Schleife gerade liest. Der Fehler sieht dann so aus, als sei die
# Tabelle kaputt ("ree: unbound variable") — sie ist es nicht.
#
# Aufruf:  ./scripts/encode-reels.sh [nummer …]   (ohne Argument: alles)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ROH=InstaReels
ZIEL=app/public/media
KARTE=scripts/reels-map.tsv
mkdir -p "$ZIEL"

command -v ffmpeg >/dev/null || { echo "ffmpeg fehlt"; exit 1; }

mapfile -t DATEIEN < <(ls -1tr "$ROH"/*.mp4)

kodiere() {
  local nr="$1" name="$2" gruppe="$3" ton="$4"
  local quelle="${DATEIEN[$((nr-1))]}"
  [ -f "$quelle" ] || { echo "  !! Quelle $nr fehlt"; return; }

  # Hochformat erkennen — davon haengt ab, worauf skaliert wird
  local wh; wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$quelle")
  local w=${wh%,*} h=${wh#*,}
  local hoch=0; [ "$h" -gt "$w" ] && hoch=1

  local skala crf ab
  case "$gruppe" in
    hero)    skala="scale='min(1280,iw)':-2";                  crf=30; ab="" ;;
    sprache) skala=$([ $hoch = 1 ] && echo "scale=-2:'min(854,ih)'" || echo "scale='min(1280,iw)':-2"); crf=33; ab="80k" ;;
    motion)  skala=$([ $hoch = 1 ] && echo "scale=-2:'min(720,ih)'" || echo "scale='min(1024,iw)':-2"); crf=34; ab="64k" ;;
    live)    skala=$([ $hoch = 1 ] && echo "scale=-2:'min(640,ih)'" || echo "scale='min(768,iw)':-2");  crf=35; ab="" ;;
  esac
  [ "$ton" = "nein" ] && ab=""

  local audio; audio=$([ -n "$ab" ] && echo "-c:a aac -b:a $ab -ac 2" || echo "-an")

  # shellcheck disable=SC2086
  ffmpeg -nostdin -y -v error -i "$quelle" -vf "$skala,format=yuv420p" \
    -c:v libx264 -crf $crf -preset slow -profile:v high -level 4.0 \
    $audio -movflags +faststart "$ZIEL/$name.mp4"

  # Poster aus der Mitte — der erste Frame ist bei Reels oft schwarz
  local dauer; dauer=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$quelle" | cut -d. -f1)
  ffmpeg -nostdin -y -v error -ss "$((dauer/3))" -i "$quelle" -vframes 1 \
    -vf "$skala" -q:v 4 "$ZIEL/$name.jpg"

  if [ "$gruppe" = "hero" ]; then
    ffmpeg -nostdin -y -v error -i "$quelle" -vf "$skala,format=yuv420p" -an \
      -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good "$ZIEL/$name.webm"
  fi

  printf "  %-38s %6s  %s\n" "$name" "$(du -h "$ZIEL/$name.mp4" | cut -f1)" "$gruppe"
}

WUNSCH=("$@")
while IFS=$'\t' read -r nr name gruppe ton rest; do
  [[ "$nr" =~ ^#|^$ ]] && continue
  if [ ${#WUNSCH[@]} -gt 0 ]; then
    treffer=0; for x in "${WUNSCH[@]}"; do [ "$x" = "$nr" ] && treffer=1; done
    [ $treffer = 1 ] || continue
  fi
  kodiere "$nr" "$name" "$gruppe" "$ton"
done < "$KARTE"

echo
echo "Gesamt: $(du -sh "$ZIEL" | cut -f1) in $ZIEL"
