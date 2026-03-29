$headers = @{ "Content-Type" = "application/json" }
$body = @{
    name = "Test User 5"
    phone = "5555555555"
    password = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/signup" -Method Post -Headers $headers -Body $body
    Write-Host "Signup Successful"
    Write-Host "Raw Response: $($response | ConvertTo-Json -Depth 5)"
    Write-Host "User: $($response.user | ConvertTo-Json)"
    Write-Host "Access Token: $($response.accessToken)"
} catch {
    Write-Host "Signup Failed"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
