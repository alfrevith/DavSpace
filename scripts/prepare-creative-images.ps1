# Optional Windows asset preparation. Originals are never overwritten.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$siteRoot = Split-Path -Parent $PSScriptRoot
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$rotations = @('RotateNoneFlipNone','RotateNoneFlipX','Rotate180FlipNone','Rotate180FlipX','Rotate90FlipX','Rotate90FlipNone','Rotate270FlipX','Rotate270FlipNone')
foreach ($collection in @(@{kind='photography';folder='photos';label='Photograph'},@{kind='drawings';folder='draws';label='Drawing'})) {
    $manifestPath = Join-Path $siteRoot ('data/' + $collection.kind + '.json')
    $existing = (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).images
    $previewDir = Join-Path $siteRoot ('images/previews/' + $collection.kind)
    New-Item -ItemType Directory -Path $previewDir -Force | Out-Null
    $records = @()
    $ordinal = 0
    foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $siteRoot ('images/' + $collection.folder)) -File | Where-Object Extension -Match '^\.(jpg|jpeg|png)$' | Sort-Object Name)) {
        $ordinal++
        $relative = 'images/' + $collection.folder + '/' + $file.Name
        $record = $existing | Where-Object image -eq $relative | Select-Object -First 1
        $picture = [System.Drawing.Image]::FromFile($file.FullName)
        try {
            if ($picture.PropertyIdList -contains 274) {
                $orientation = [BitConverter]::ToUInt16($picture.GetPropertyItem(274).Value,0)
                if ($orientation -ge 1 -and $orientation -le 8) { $picture.RotateFlip([System.Drawing.RotateFlipType]::$($rotations[$orientation-1])) }
            }
            $scale = [Math]::Min([double]1,[double](1100 / [Math]::Max($picture.Width,$picture.Height)))
            $previewWidth = [Math]::Max(1,[int][Math]::Round($picture.Width*$scale))
            $previewHeight = [Math]::Max(1,[int][Math]::Round($picture.Height*$scale))
            $bitmap = [System.Drawing.Bitmap]::new($previewWidth,$previewHeight)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
            try {
                $graphics.Clear([System.Drawing.Color]::White)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($picture,0,0,$previewWidth,$previewHeight)
                $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]85)
                $previewName = $file.BaseName + '-' + $file.Extension.TrimStart('.') + '.jpg'
                $bitmap.Save((Join-Path $previewDir $previewName),$jpegCodec,$parameters)
                $records += [ordered]@{
                    id = $(if($record){$record.id}else{$collection.kind + '-' + ($file.BaseName -replace '[^a-zA-Z0-9_-]','-') + '-' + $file.Extension.TrimStart('.')})
                    image = $relative
                    thumbnail = 'images/previews/' + $collection.kind + '/' + $previewName
                    title = $(if($record){$record.title}else{$collection.label + ' ' + $ordinal.ToString('00')})
                    description = $(if($record){$record.description}else{''})
                    date = $(if($record){$record.date}else{''})
                    camera = $(if($record){$record.camera}else{''})
                    location = $(if($record){$record.location}else{''})
                    width = $picture.Width
                    height = $picture.Height
                    previewWidth = $previewWidth
                    previewHeight = $previewHeight
                    order = $(if($record){$record.order}else{$ordinal})
                }
            } finally { $parameters.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
        } finally { $picture.Dispose() }
    }
    [ordered]@{images=@($records)} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
    Write-Output ($collection.kind + ': ' + $records.Count + ' images prepared')
}
