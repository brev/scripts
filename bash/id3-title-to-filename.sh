#!/usr/bin/env bash

for FILE in *.mp3
do
  id3tag --song="$FILE" "$FILE"
done

