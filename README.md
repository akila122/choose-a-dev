# Choose a Dev

Catch the good stuff, dodge the bugs, fill the vessel. Every stage swaps the picture.

## Images

Put 4 images per character in `img/`, portrait 9:16, white background:

```
img/aleksa-1.jpg … aleksa-4.jpg
img/stefan-1.jpg … stefan-4.jpg
img/adam-1.jpg   … adam-4.jpg
```

Missing images fall back to a grey placeholder.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tuning

Constants at the top of `game.js`: `STAGE_AT` (fill % per image, 100% wins), `LIVES`, `FILL_PER_CATCH`, `TRAP_PENALTY`.
