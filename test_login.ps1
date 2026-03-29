$headers = @{ "Content-Type" = "application/json" }
$body = @{
    phone = "8888888888"
    password = "password123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/signin" -Method Post -Headers $headers -Body $body
    Write-Host "Login Successful"
    Write-Host "Access Token: $($response.accessToken)"
    Write-Host "Refresh Token: $($response.refreshToken)"
    Write-Host "User: $($response.user | ConvertTo-Json)"
} catch {
    Write-Host "Login Failed"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())"
    }
}
