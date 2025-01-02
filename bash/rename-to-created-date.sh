#!/usr/bin/env bash

FILES=("$@")

if (( ${#FILES[@]} == 0 )); then
  cat <<"EOM"
    Usage: 
      ./script.sh file1.jpg
      ./script.sh file1.jpg file2.jpg ...
      ./script.sh *.jpg
EOM
  exit 1
fi

COUNT=1
COUNT_DISPLAY="0$COUNT"
LAST_CREATED=
SORTED=($(ls -tUr ${FILES[@]}))

for FILE in "${SORTED[@]}"; do
  EXTENSION="${FILE##*.}"
  CREATED=$(stat -f '%SB' -t '%F' $FILE)

  if [ "$CREATED" = "$LAST_CREATED" ]; then
    COUNT=$((COUNT+1)) 
    if [ "$COUNT" -lt "10" ]; then
      COUNT_DISPLAY="0$COUNT"
    else
      COUNT_DISPLAY="$COUNT"
    fi
  else
    COUNT=1
    COUNT_DISPLAY="0$COUNT"
  fi

  mv "$FILE" "$CREATED--$COUNT_DISPLAY.$EXTENSION"

  LAST_CREATED=$CREATED
done
