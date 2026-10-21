param(
    [int]$AppProcessId = 0,
    [ValidateRange(2, 60)][int]$Seconds = 15
)
$ErrorActionPreference = 'Stop'
# Inspect only Threadnote's process tree; never collect command lines or user content.
if ($AppProcessId -eq 0) {
    $apps = @(Get-Process -Name threadnote -ErrorAction SilentlyContinue)
    if ($apps.Count -ne 1) { throw 'Specify -AppProcessId for a running Threadnote process.' }
    $AppProcessId = $apps[0].Id
}
$app = Get-Process -Id $AppProcessId
if ($app.ProcessName -ne 'threadnote') { throw 'The selected process is not Threadnote.' }
function Read-AppTree {
    $snapshot = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($AppProcessId)
    do {
        $added = $false
        foreach ($item in $snapshot) {
            if ($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)) { $added = $true }
        }
    } while ($added)
    @(Get-Process -Id @($ids) -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet64, PrivateMemorySize64)
}
$before = @{}
foreach ($item in (Read-AppTree)) { $before[$item.Id] = $item.CPU }
$watch = [System.Diagnostics.Stopwatch]::StartNew()
Start-Sleep -Seconds $Seconds
$after = @(Read-AppTree)
$elapsed = $watch.Elapsed.TotalSeconds
$cpuSeconds = 0.0
foreach ($item in $after) {
    $initial = if ($before.ContainsKey($item.Id)) { $before[$item.Id] } else { 0 }
    $cpuSeconds += [math]::Max(0, $item.CPU - $initial)
}
[pscustomobject]@{
    Executable = $app.Path
    ProcessCount = $after.Count
    SampleSeconds = [math]::Round($elapsed, 2)
    CpuPercent = [math]::Round(100 * $cpuSeconds / $elapsed / [Environment]::ProcessorCount, 2)
    PrivateCommitMiB = [math]::Round(($after | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
    WorkingSetMiB = [math]::Round(($after | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
    Notes = 'Includes WebView descendants. Working sets may double-count shared pages. Private commit is not physical RAM. Exited child CPU is excluded. Compare the same cards and window visibility.'
} | ConvertTo-Json
