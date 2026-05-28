# Render a Hermes Secret-tier compose with your real credentials.
#
# Usage from PowerShell, in wizard/:
#   .\scripts\render-hermes-secret.ps1 -SecretAiKey "sk-..." -BotToken "123:abc" -ChatId "12345"
#
# Optionally pick a different model (default gemma4:31b):
#   .\scripts\render-hermes-secret.ps1 ... -Model "qwq:32b"
#
# Writes the compose to C:\dev\secret-claw\hermes-secret-compose.yml.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SecretAiKey,
    [Parameter(Mandatory = $true)][string]$BotToken,
    [Parameter(Mandatory = $true)][string]$ChatId,
    [ValidateSet("gemma4:31b", "qwq:32b", "qwen3-vl:32b")]
    [string]$Model = "gemma4:31b",
    [string]$OutFile = "C:\dev\secret-claw\hermes-secret-compose.yml"
)

$payload = @{
    runtime          = "hermes"
    tier             = "secret"
    secretaiApiKey   = $SecretAiKey
    secretaiModel    = $Model
    telegramBotToken = $BotToken
    telegramChatId   = $ChatId
} | ConvertTo-Json -Compress

# Use cmd.exe to redirect stderr (the metadata banner) to $null and
# stdout to the file directly. PS 5.1 pipelines wrap native-exe stderr in
# ErrorRecords which contaminate the pipeline; bypassing PS entirely is
# cleanest. The output file ends up UTF-8 without BOM by default.
$tmpJson = New-TemporaryFile
Set-Content -Path $tmpJson -Value $payload -Encoding Ascii -NoNewline
try {
    cmd /c "npx tsx scripts\render-cli.ts < `"$tmpJson`" > `"$OutFile`" 2> nul"
} finally {
    Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue
}

$size = (Get-Item $OutFile).Length
Write-Host "Wrote $OutFile ($size bytes)"
