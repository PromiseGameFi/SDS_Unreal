$ts = [Int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$sender = '0xc8F59daEa91f30F4F6D85E5c510d78bd1ac4b19e'
$msg = "ordered encoder test via script (sender=publisher) | $(Get-Date -Format o) | id=$([guid]::NewGuid().ToString())"
$body = [pscustomobject]@{
  label = 'chat'
  values = [pscustomobject]@{
    timestamp = $ts
    message = $msg
    sender = $sender
  }
}
$json = $body | ConvertTo-Json -Depth 6
Write-Host "REQUEST: $json"
$response = Invoke-RestMethod -Uri 'http://localhost:3000/data/publish' -Method Post -ContentType 'application/json' -Body $json
Write-Host "PUBLISH RESPONSE: " ($response | ConvertTo-Json -Depth 8 -Compress)

Start-Sleep -Milliseconds 1500

# Read back using getByKey
$schemaId = $response.schemaId
$dataId = $response.dataId
$readBody = [pscustomobject]@{ schemaId = $schemaId; publisher = $sender; dataId = $dataId }
$readJson = $readBody | ConvertTo-Json -Depth 6
Write-Host "READ REQUEST: $readJson"
$readResp = Invoke-RestMethod -Uri 'http://localhost:3000/data/getByKey' -Method Post -ContentType 'application/json' -Body $readJson
Write-Host "READ RESPONSE: " ($readResp | ConvertTo-Json -Depth 12 -Compress)

# Extract simplified decoded values
$decoded = @{}
foreach ($item in $readResp.data[0]) { $decoded[$item.name] = $item.value.value }
Write-Host ("DECODED: schemaId={0} dataId={1} publisher={2} timestamp={3} message='{4}' sender={5}" -f $schemaId, $dataId, $sender, $decoded['timestamp'], $decoded['message'], $decoded['sender'])

if ($decoded['message'] -eq $msg) {
  Write-Host "VERIFIED: Read message matches published payload" -ForegroundColor Green
} else {
  Write-Warning "Mismatch: read message does not match published payload"
}