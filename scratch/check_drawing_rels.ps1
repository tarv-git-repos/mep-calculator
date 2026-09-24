Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('z:\00 R&D Server\04 MISC\Vikrams  MEP CALCULATOR UPDATED\vikram_updated_calc\New Ui MEP\MEP_Calculator_Project\CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx')
$zip.Entries | Where-Object { $_.FullName -like '*drawing*.xml.rels' } | ForEach-Object {
    Write-Host "=== Entry: $($_.FullName) ==="
    $stream = $_.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd()
    Write-Host $text
    $reader.Close()
    $stream.Close()
}
$zip.Dispose()
