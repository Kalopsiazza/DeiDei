param([ValidateSet('signature','processes','install')][string]$Mode, [string]$File, [string]$Destination)
$ErrorActionPreference = 'Stop'
if ($Mode -eq 'signature') {
  $signature = Get-AuthenticodeSignature -LiteralPath $File
  $publisher = if ($signature.SignerCertificate) { $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) } else { $null }
  @{ status = $signature.Status.ToString(); publisher = $publisher } | ConvertTo-Json -Compress
} elseif ($Mode -eq 'processes') {
  @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $File } | ForEach-Object { $_.ProcessId }) | ConvertTo-Json -Compress
} else {
  # NSIS /D must be last and unquoted; Start-Process joins these arguments without running a shell.
  $process = Start-Process -FilePath $File -ArgumentList @('/S', ('/D=' + $Destination)) -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw ('FIXTURE_INSTALL_FAILED_' + $process.ExitCode) }
}
