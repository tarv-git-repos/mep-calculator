Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('z:\00 R&D Server\04 MISC\Vikrams  MEP CALCULATOR UPDATED\vikram_updated_calc\New Ui MEP\MEP_Calculator_Project\CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx')
$zip.Entries | Where-Object { $_.FullName -like '*image*' -or $_.FullName -like '*media*' } | ForEach-Object {
    Write-Host $_.FullName $_.Length
    if ($_.FullName -like '*media/*') {
        $dest = Join-Path 'z:\00 R&D Server\04 MISC\Vikrams  MEP CALCULATOR UPDATED\vikram_updated_calc\New Ui MEP\MEP_Calculator_Project\scratch' (Split-Path $_.FullName -Leaf)
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($_, $dest, $true)
        Write-Host "Extracted to $dest"
    }
}
$zip.Dispose()
