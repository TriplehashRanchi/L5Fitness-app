# Body avatar artwork

The Home screen bodies (`assets/images/body-{male|female}-{thin|normal|heavy|obese}-{empty|water}.webp`) are
generated from `reference.png` (male) and `reference-female.png` (female) with Python (`numpy`, `scipy`,
`opencv-python`). The app picks the build from the member's BMI: under 18.5 thin, under 25 normal, under 30
heavy, 30 and over obese.

Run everything from one empty working folder, with these scripts copied into it:

    mkdir out f2 f2/out var
    python3 sil.py reference.png                      # male silhouette -> body.npy
    python3 build.py reference.png out                # out/body-empty.png, out/body-water.png, meta.json
    cd f2
    python3 ../lift.py ../reference-female.png female-lifted.png 28   # lifts the bust a little
    python3 ../sil_f.py female-lifted.png             # female silhouette
    python3 ../build_f.py female-lifted.png out       # removes the bubbles, makes the empty and water pictures
    cd ..
    python3 variants.py out body var                  # male thin / heavy / obese
    python3 variants.py f2/out body-female var        # female thin / heavy / obese
    python3 pack.py /path/to/L5Fitness-app            # writes the .webp assets and body-avatar-outline.ts

`build_f.py` reuses the light measured on the male figure (`teal.npy`, `bgT.npy`), so run `build.py` first.
How much each part widens per build is the table at the top of `variants.py`.
