# Publish API to Remote Docker Machine (Windows PowerShell)

$remote = "root@192.168.10.2"
$remotePath = "~/api-achiropita"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$originalLocation = Get-Location

Set-Location $scriptPath

try {
    Write-Host "--- Preparando pacote de deploy (removendo node_modules)..." -ForegroundColor Cyan

    # Cria um arquivo tar temporário apenas com o necessário
    # Usamos o PowerArchiver ou o tar nativo do Windows 10+
    tar --exclude="node_modules" --exclude="dist" --exclude=".env" --exclude="deploy.ps1" --exclude="*.tar.gz" -czf deploy-api.tar.gz .

    Write-Host "--- Transferindo arquivos para $remote..." -ForegroundColor Cyan
    ssh $remote "mkdir -p $remotePath && rm -rf $remotePath/*"
    scp deploy-api.tar.gz "$($remote):$remotePath"
    scp .env "$($remote):~/api-achiropita.env"

    Write-Host "--- Executando build e deploy remoto..." -ForegroundColor Cyan
    $commands = @(
        "cd $remotePath",
        "tar -xzf deploy-api.tar.gz",
        "rm deploy-api.tar.gz",
        "docker build -t api-achiropita .",
        "docker stop api-achiropita 2>/dev/null || true",
        "docker rm api-achiropita 2>/dev/null || true",
        "docker run -d --name api-achiropita --restart unless-stopped --env-file ~/api-achiropita.env -p 8081:8081 api-achiropita"
    ) -join " && "

    ssh $remote $commands

    # Limpa o arquivo local
    if (Test-Path deploy-api.tar.gz) {
        Remove-Item deploy-api.tar.gz
    }

    Write-Host "--- Deploy concluído com sucesso!" -ForegroundColor Green
    Write-Host "Acesse: http://192.168.10.2:8081/health" -ForegroundColor Yellow
    Write-Host "Dica: Se houver erro de TLS/SSL no banco, adicione 'DATABASE_SSL=false' no arquivo ~/api-achiropita.env da máquina remota." -ForegroundColor Gray
}
finally {
    Set-Location $originalLocation
}

Write-Host "--- Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "Acesse: http://192.168.10.2:8081/health" -ForegroundColor Yellow
