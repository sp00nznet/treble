Add-Type @"
using System; using System.Runtime.InteropServices;
public class U {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@
[U]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$exe = "D:\projects\treble\app\src-tauri\target\release\treble.exe"
$OX=0; $OY=0; $S=2; $global:hwnd=$null
function Click($cx,$cy){ [U]::SetCursorPos($OX+$cx*$S, $OY+$cy*$S); Start-Sleep -m 300; [U]::mouse_event(0x2,0,0,0,0); [U]::mouse_event(0x4,0,0,0,0); Start-Sleep -m 900 }
function Shot($name){ $r=New-Object U+RECT; [void][U]::GetWindowRect($global:hwnd,[ref]$r); $w=$r.R-$r.L; $ht=$r.B-$r.T; if($w -le 0){return}; $full=New-Object System.Drawing.Bitmap($w,$ht); $g=[System.Drawing.Graphics]::FromImage($full); $hdc=$g.GetHdc(); [void][U]::PrintWindow($global:hwnd,$hdc,2); $g.ReleaseHdc($hdc); $g.Dispose(); $half=New-Object System.Drawing.Bitmap([int]($w/2),[int]($ht/2)); $g2=[System.Drawing.Graphics]::FromImage($half); $g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g2.DrawImage($full,0,0,[int]($w/2),[int]($ht/2)); $g2.Dispose(); $half.Save("D:\projects\treble\screenshots\$name",[System.Drawing.Imaging.ImageFormat]::Png); $half.Dispose(); $full.Dispose() }
New-Item -ItemType Directory -Force -Path "D:\projects\treble\screenshots" | Out-Null
Stop-Process -Name treble -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
$p = Start-Process $exe -PassThru
Start-Sleep -Seconds 10
$p.Refresh(); $global:hwnd = $p.MainWindowHandle
[U]::SetWindowPos($global:hwnd, [IntPtr]::Zero, 0, 0, 3840, 2160, 0x0040) | Out-Null
Start-Sleep -Seconds 2
Click 60 130; Start-Sleep -m 400          # warmup/focus
Click 60 167; Start-Sleep -m 500          # Search
[System.Windows.Forms.SendKeys]::SendWait("the strokes the adults are talking"); Start-Sleep -Seconds 6; Shot "search.png"
Click 350 250; Start-Sleep -Seconds 6     # play first result (has lyrics)
Click 1765 215; Start-Sleep -Seconds 3; Shot "fullplayer.png"   # themed full-screen + lyrics
[System.Windows.Forms.SendKeys]::SendWait("{ESC}"); Start-Sleep -m 800
Click 60 130; Shot "home.png"
Click 60 241; Shot "library.png"
Click 60 315; Shot "settings.png"
Click 70 430; Start-Sleep -Seconds 2; Shot "playlist.png"   # Imported from Spotify (Nas cover)
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Name treble -Force -ErrorAction SilentlyContinue
"done"
