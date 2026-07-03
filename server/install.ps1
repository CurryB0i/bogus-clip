$ErrorActionPreference = "Stop"

Write-Host "Step 0: sanity check"
python --version
pip --version

Write-Host "Step 1: upgrade pip toolchain"
python -m pip install --upgrade pip setuptools wheel

Write-Host "Step 2: install non-torch requirements"
pip install -r requirements.txt

Write-Host "Step 3: remove any torch garbage whisperx pulled in"
pip uninstall -y torch torchaudio torchvision | Out-Null

Write-Host "Step 4: detect NVIDIA GPU"
$gpuPresent = $false
try {
    nvidia-smi | Out-Null
    $gpuPresent = $true
    Write-Host "✅ NVIDIA GPU detected"
} catch {
    Write-Host "⚠️ No NVIDIA GPU detected — installing CPU torch"
}

if ($gpuPresent) {
    Write-Host "Step 5A: install CUDA-enabled torch (cu121)"
    pip install torch==2.5.1 torchaudio==2.5.1 torchvision==0.20.1 `
      --index-url https://download.pytorch.org/whl/cu121 `
      --no-cache-dir
} else {
    Write-Host "Step 5B: install CPU torch"
    pip install torch==2.5.1 torchaudio==2.5.1 torchvision==0.20.1 `
      --no-cache-dir
}

Write-Host "✅ DONE."
