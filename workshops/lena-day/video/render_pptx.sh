#!/bin/zsh
# render_pptx.sh <deck.pptx> <outdir> — render every slide of the actual generated deck to PNG via LibreOffice (headless) + PyMuPDF.
set -e
deck=$1; out=$2; mkdir -p "$out"
T=/private/var/folders/8j/hhcc8zs100d3fd654fjkk9580000gn/T/opencode
cp "$deck" "$out/deck.pptx"
/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --norestore -env:UserInstallation=file://$T/lo-profile --convert-to pdf --outdir "$out" "$out/deck.pptx" >/dev/null 2>&1
$T/pptx-venv/bin/python -c "import fitz,sys; d=fitz.open(sys.argv[1]); [p.get_pixmap(dpi=300).save(f'{sys.argv[2]}/slide-{i+1:02d}.png') for i,p in enumerate(d)]; print(len(d))" "$out/deck.pdf" "$out"
