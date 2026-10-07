# Persistent Windows PowerShell 5.1 bridge. No user-supplied code is evaluated.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
  $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
  $streamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
  $readerType = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  function Await($operation, [Type]$resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    if (-not $task.Wait(8000)) { throw 'Windows media request timed out.' }
    return $task.Result
  }
  $manager = Await ($managerType::RequestAsync()) $managerType
  $startupError = $null
} catch { $startupError = 'Windows media sessions are unavailable. Use Windows 10 version 1809 or newer, or configure the optional Spotify account connection.' }
while ($null -ne ($line = [Console]::ReadLine())) {
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    if ($startupError) { throw $startupError }
    $allowed = @('status','play','pause','next','previous')
    if ($allowed -notcontains $request.action) { throw 'Unsupported local Spotify action.' }
    $sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match '(?i)spotify' })
    $current = $manager.GetCurrentSession()
    $session = $sessions | Where-Object { $_.SourceAppUserModelId -eq $current.SourceAppUserModelId } | Select-Object -First 1
    if (-not $session) { $session = $sessions | Select-Object -First 1 }
    if (-not $session) {
      if ($request.action -ne 'status') { throw 'Open Spotify on this PC and start a song first.' }
      $result = @{ connected=$true; source='windows-native'; item=$null; isPlaying=$false; canControl=$false; device='This Windows PC'; statusMessage='Open Spotify on this PC and start a song.' }
    } else {
      $source = [string]$session.SourceAppUserModelId
      $info = $session.GetPlaybackInfo()
      $controls = $info.Controls
      if ($request.action -ne 'status') {
        if ($request.sessionId -ne $source) { throw 'The Spotify session changed. Refresh playback before controlling it.' }
        $accepted = $false
        switch ($request.action) {
          'play' { if (-not $controls.IsPlayEnabled) { throw 'Spotify has not enabled Play.' }; $accepted = Await ($session.TryPlayAsync()) ([bool]) }
          'pause' { if (-not $controls.IsPauseEnabled) { throw 'Spotify has not enabled Pause.' }; $accepted = Await ($session.TryPauseAsync()) ([bool]) }
          'next' { if (-not $controls.IsNextEnabled) { throw 'Spotify has not enabled Next.' }; $accepted = Await ($session.TrySkipNextAsync()) ([bool]) }
          'previous' { if (-not $controls.IsPreviousEnabled) { throw 'Spotify has not enabled Previous.' }; $accepted = Await ($session.TrySkipPreviousAsync()) ([bool]) }
        }
        $result = @{ok=[bool]$accepted; requested=$true; source='windows-native'; confirmed=$false}
        if (-not $accepted) { throw 'Spotify declined that Windows media command.' }
      } else {
        $media = Await ($session.TryGetMediaPropertiesAsync()) $propertiesType
        $timeline = $session.GetTimelineProperties()
        $image = ''
        # Artwork is optional and bounded; failure never blocks basic playback.
        if ($media.Thumbnail) {
          $stream = $null; $reader = $null
          try {
            $stream = Await ($media.Thumbnail.OpenReadAsync()) $streamType
            if ($stream.Size -gt 0 -and $stream.Size -le 1048576 -and $stream.ContentType -match '^image/(jpeg|png|webp)$') {
              $reader = $readerType::new($stream.GetInputStreamAt(0))
              $length = [uint32]$stream.Size
              $loaded = Await ($reader.LoadAsync($length)) ([uint32])
              if ($loaded -eq $length) { $bytes=New-Object byte[] $length; $reader.ReadBytes($bytes); $image='data:'+$stream.ContentType+';base64,'+[Convert]::ToBase64String($bytes) }
            }
          } catch {} finally { if ($reader) { $reader.Dispose() }; if ($stream) { $stream.Dispose() } }
        }
        $result = @{connected=$true; source='windows-native'; sessionId=$source; isPlaying=($info.PlaybackStatus.ToString() -eq 'Playing'); progressMs=[Math]::Max(0,$timeline.Position.TotalMilliseconds-$timeline.StartTime.TotalMilliseconds); durationMs=[Math]::Max(0,$timeline.EndTime.TotalMilliseconds-$timeline.StartTime.TotalMilliseconds); device='This Windows PC'; canControl=($controls.IsPlayEnabled -or $controls.IsPauseEnabled -or $controls.IsNextEnabled -or $controls.IsPreviousEnabled); canPause=[bool]$controls.IsPauseEnabled; canResume=[bool]$controls.IsPlayEnabled; canNext=[bool]$controls.IsNextEnabled; canPrevious=[bool]$controls.IsPreviousEnabled; item=@{name=[string]$media.Title; artists=@([string]$media.Artist); album=[string]$media.AlbumTitle; imageUrl=$image; uri=''; externalUrl=''}}
      }
    }
    [Console]::Out.WriteLine((@{id=$request.id; result=$result} | ConvertTo-Json -Depth 6 -Compress))
  } catch { [Console]::Out.WriteLine((@{id=$request.id; error=$_.Exception.Message} | ConvertTo-Json -Depth 4 -Compress)) }
}
