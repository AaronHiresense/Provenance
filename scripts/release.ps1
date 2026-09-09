param(
    [string]$Message = "PROVENANCE release",
    [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

if (git status --porcelain) {
    throw "Release requires a clean tracked worktree. Commit intended changes first."
}
$commit = (git rev-parse HEAD).Trim()
$remote = (git ls-remote origin refs/heads/main).Split("`t")[0]
if ($remote -ne $commit) {
    throw "HEAD $commit is not remote main $remote. Push/merge main first."
}

if (-not $SkipChecks) {
    python -m pytest tests/ -q -p no:cacheprovider --basetemp=.test-tmp-release
    if ($LASTEXITCODE) { throw "Python tests failed." }
    Push-Location frontend
    try { cmd /c npm run build } finally { Pop-Location }
    if ($LASTEXITCODE) { throw "Frontend build failed." }
    python eval.py
    if ($LASTEXITCODE) { throw "Offline evaluation failed." }
    if (git status --porcelain) {
        throw "Checks changed tracked files. Commit the generated frontend before release."
    }
}

$stage = Join-Path $repo ".release-staging"
if (Test-Path -LiteralPath $stage) {
    $resolved = [System.IO.Path]::GetFullPath($stage)
    if ($resolved -ne (Join-Path $repo ".release-staging")) {
        throw "Refusing to clear unexpected staging path $resolved"
    }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
New-Item -ItemType Directory -Path $stage | Out-Null
git archive --format=tar HEAD -o (Join-Path $stage "source.tar")
tar -xf (Join-Path $stage "source.tar") -C $stage
Remove-Item -LiteralPath (Join-Path $stage "source.tar")

$manifest = [ordered]@{
    source_commit = $commit
    built_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    policy_version = "legacy-v1"
    schema_version = "none"
}
$manifestJson = $manifest | ConvertTo-Json
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $stage "release-manifest.json"), $manifestJson, $utf8NoBom)

$env:RAILWAY_CALLER = "skill:use-railway@1.2.1"
$env:RAILWAY_AGENT_SESSION = "provenance-release-$($commit.Substring(0, 12))"
railway up $stage --path-as-root --project 6b7e727c-b4d0-4ca5-991b-12634e353984 `
  --environment 1f2ef59c-2ee0-43a3-ba3a-358eb5b91c87 `
  --service 18bf1cef-e8c9-43e7-976e-410d55369437 --detach --json `
  --message "$Message [$($commit.Substring(0, 12))]"
if ($LASTEXITCODE) { throw "Railway upload failed." }

Write-Host "Uploaded $commit. Follow its deployment to SUCCESS, then verify /api/runtime."
