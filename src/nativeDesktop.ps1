param([switch]$CompileOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public static class MirrorDesktopInput {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION data; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam, uint flags, uint timeout, out UIntPtr result);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr awareness);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint count, INPUT[] inputs, int size);

  public static void GestureScroll(int x, int y, int delta, long mirrorWindow, int left, int top, int right, int bottom) {
    if (delta == 0 || Math.Abs((long)delta) > 720 || x < left || x >= right || y < top || y >= bottom)
      throw new InvalidOperationException("Gesture scroll must target the visible app area on the TV.");
    if (x < -32768 || x > 32767 || y < -32768 || y > 32767)
      throw new InvalidOperationException("This display's coordinates are outside Windows wheel-message range.");
    POINT point = new POINT(); point.x = x; point.y = y;
    IntPtr target = WindowFromPoint(point); IntPtr root = GetAncestor(target, 2);
    if (target == IntPtr.Zero || root == IntPtr.Zero || root.ToInt64() == mirrorWindow || !IsWindowVisible(root))
      throw new InvalidOperationException("There is no native app under the gesture scroll point. Return to the mirror or open an app.");
    uint process; GetWindowThreadProcessId(root, out process);
    if (process == 0) throw new InvalidOperationException("The app closed before gesture scrolling.");
    if (WindowFromPoint(point) != target) throw new InvalidOperationException("The visible app changed before gesture scrolling. Swipe again.");
    int wheel = -Math.Sign(delta) * Math.Max(1, (int)Math.Round(Math.Abs(delta) / 90.0)) * 120;
    uint wParam = unchecked((uint)((ushort)wheel << 16));
    int lParam = unchecked((int)((ushort)x | ((uint)(ushort)y << 16)));
    UIntPtr result;
    // Direct user gesture, with no screenshot or window text sent to the model.
    // A timeout avoids hanging voice controls on an unresponsive target app.
    if (SendMessageTimeout(target, 0x020A, new UIntPtr(wParam), new IntPtr(lParam), 2, 1500, out result) == IntPtr.Zero)
      throw new InvalidOperationException("The app did not accept the wheel message. Elevated or unresponsive apps may require direct input.");
  }
  public static void CheckFocus(long expectedWindow, uint expectedProcess) {
    IntPtr window = GetForegroundWindow(); uint processId;
    GetWindowThreadProcessId(window, out processId);
    if (window.ToInt64() != expectedWindow || processId != expectedProcess) throw new InvalidOperationException("Desktop focus changed. Inspect the screen again before acting.");
  }
  static INPUT Key(ushort code, bool up, bool unicode) {
    INPUT input = new INPUT(); input.type = 1;
    input.data.ki.wVk = unicode ? (ushort)0 : code;
    input.data.ki.wScan = unicode ? code : (ushort)0;
    input.data.ki.dwFlags = (up ? 2u : 0u) | (unicode ? 4u : 0u);
    return input;
  }
  static void Send(INPUT[] inputs) {
    if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length) throw new InvalidOperationException("Windows rejected desktop input. Elevated apps and secure screens may require direct user input.");
  }
  public static void Text(long window, uint process, string text) {
    CheckFocus(window, process);
    List<INPUT> inputs = new List<INPUT>();
    foreach (char c in text) { inputs.Add(Key(c, false, true)); inputs.Add(Key(c, true, true)); }
    Send(inputs.ToArray());
  }
  public static void Keys(long window, uint process, ushort[] codes) {
    CheckFocus(window, process);
    List<INPUT> inputs = new List<INPUT>();
    foreach (ushort code in codes) inputs.Add(Key(code, false, false));
    for (int i = codes.Length - 1; i >= 0; i--) inputs.Add(Key(codes[i], true, false));
    Send(inputs.ToArray());
  }
  public static void Mouse(long window, uint process, int x, int y, int wheel, int clicks) {
    CheckFocus(window, process);
    if (!SetCursorPos(x, y)) throw new InvalidOperationException("Windows could not move the pointer on this desktop.");
    CheckFocus(window, process);
    INPUT first = new INPUT(); first.type = 0;
    if (clicks > 0) {
      first.data.mi.dwFlags = 2;
      INPUT second = new INPUT(); second.type = 0; second.data.mi.dwFlags = 4;
      if (clicks == 2) Send(new INPUT[] { first, second, first, second });
      else if (clicks == 1) Send(new INPUT[] { first, second });
      else throw new InvalidOperationException("Only single or double clicks are supported.");
    } else {
      first.data.mi.dwFlags = 0x0800; first.data.mi.mouseData = unchecked((uint)wheel);
      Send(new INPUT[] { first });
    }
  }
}
'@
if ($CompileOnly) { [Console]::Out.Write([Runtime.InteropServices.Marshal]::SizeOf([type][MirrorDesktopInput+INPUT])); exit 0 }

try {
  try { [void][MirrorDesktopInput]::SetThreadDpiAwarenessContext([IntPtr](-4)) }
  catch { [void][MirrorDesktopInput]::SetProcessDPIAware() }
  $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:MIRROR_DESKTOP_INPUT)) | ConvertFrom-Json
  if ($payload.op -eq 'gesture_scroll') {
    [MirrorDesktopInput]::GestureScroll($payload.x, $payload.y, $payload.deltaY, [long]$payload.mirrorWindowId, $payload.bounds.left, $payload.bounds.top, $payload.bounds.right, $payload.bounds.bottom)
    [Console]::Out.Write('{"result":"Native app scroll requested"}'); exit 0
  }
  $window = [MirrorDesktopInput]::GetForegroundWindow()
  [uint32]$processId = 0
  [void][MirrorDesktopInput]::GetWindowThreadProcessId($window, [ref]$processId)
  $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
  if ($processName -match '^Spotify$') { throw 'Spotify content and native input stay outside the AI harness. Use the local Music controls.' }
  if ($payload.op -eq 'state') {
    $title = New-Object Text.StringBuilder 1024
    [void][MirrorDesktopInput]::GetWindowText($window, $title, $title.Capacity)
    if ($title.ToString() -match 'Spotify') { throw 'Spotify screen content stays local. Use the local Music controls.' }
    $rect = New-Object MirrorDesktopInput+RECT
    if (-not [MirrorDesktopInput]::GetWindowRect($window, [ref]$rect)) { throw 'The foreground window could not be inspected.' }
    $result = @{ id = $window.ToInt64().ToString(); processId = $processId; processName = $processName; title = $title.ToString(); bounds = @{ x = $rect.Left; y = $rect.Top; width = $rect.Right - $rect.Left; height = $rect.Bottom - $rect.Top } }
  } else {
    [long]$expectedWindow = $payload.expectedWindowId
    [uint32]$expectedProcess = $payload.expectedProcessId
    $currentRect = New-Object MirrorDesktopInput+RECT
    if (-not [MirrorDesktopInput]::GetWindowRect($window, [ref]$currentRect)) { throw 'The foreground window could not be inspected.' }
    $expectedRect = $payload.expectedBounds
    if ([Math]::Abs($currentRect.Left - $expectedRect.x) -gt 2 -or [Math]::Abs($currentRect.Top - $expectedRect.y) -gt 2 -or [Math]::Abs(($currentRect.Right - $currentRect.Left) - $expectedRect.width) -gt 2 -or [Math]::Abs(($currentRect.Bottom - $currentRect.Top) - $expectedRect.height) -gt 2) { throw 'The foreground window moved or resized. Inspect the screen again.' }
    switch ($payload.op) {
      'click' { [MirrorDesktopInput]::Mouse($expectedWindow, $expectedProcess, $payload.x, $payload.y, 0, 1) }
      'double_click' { [MirrorDesktopInput]::Mouse($expectedWindow, $expectedProcess, $payload.x, $payload.y, 0, 2) }
      'scroll' { $wheel = -[Math]::Sign($payload.deltaY) * [Math]::Max(1, [Math]::Round([Math]::Abs($payload.deltaY) / 90)) * 120; [MirrorDesktopInput]::Mouse($expectedWindow, $expectedProcess, $payload.x, $payload.y, $wheel, 0) }
      'type_text' { [MirrorDesktopInput]::Text($expectedWindow, $expectedProcess, $payload.text) }
      'press_key' {
        $keys = @{ enter=13; tab=9; escape=27; backspace=8; space=32; up=38; down=40; left=37; right=39; home=36; end=35; pageup=33; pagedown=34; win=91; 'ctrl+a'=@(17,65); 'ctrl+l'=@(17,76); 'ctrl+f'=@(17,70); 'alt+tab'=@(18,9) }
        if (-not $keys.ContainsKey($payload.key)) { throw 'Unsupported native key.' }
        [MirrorDesktopInput]::Keys($expectedWindow, $expectedProcess, [ushort[]]@($keys[$payload.key]))
      }
      default { throw 'Unsupported native desktop action.' }
    }
    $result = @{ result = 'Native desktop input sent. Inspect the screen to verify the result.' }
  }
  [Console]::Out.Write(($result | ConvertTo-Json -Depth 5 -Compress))
} catch { [Console]::Out.Write((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)); exit 1 }
