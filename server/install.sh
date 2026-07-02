#!/usr/bin/env bash
set -e

echo "Step 0: sanity check"
python -V
pip -V

echo " Step 1: upgrade pip toolchain"
pip install --upgrade pip setuptools wheel

echo "Step 2: install non-torch requirements"
pip install -r requirements.txt

echo "Step 3: remove any torch garbage whisperx pulled in"
pip uninstall -y torch torchaudio torchvision || true

echo "Step 4: detect NVIDIA GPU"
if command -v nvidia-smi >/dev/null 2>&1; then
  GPU_PRESENT=true
  echo "✅ NVIDIA GPU detected"
else
  GPU_PRESENT=false
  echo "⚠️ No NVIDIA GPU detected — installing CPU torch"
fi

if [ "$GPU_PRESENT" = true ]; then
  echo "Step 5A: install CUDA-enabled torch (cu121)"
  pip install torch==2.5.1 torchaudio==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cu121 \
    --no-cache-dir
else
  echo "Step 5B: install CPU torch"
  pip install torch==2.5.1 torchaudio==2.5.1 torchvision==0.20.1 \
    --no-cache-dir
fi

echo "✅ DONE."

