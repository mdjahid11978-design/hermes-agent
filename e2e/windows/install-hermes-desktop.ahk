#Requires AutoHotkey v2.0
#SingleInstance Force
#ErrorStdOut "UTF-8"

SetWorkingDir(A_ScriptDir)
CoordMode("Pixel", "Screen")
CoordMode("Mouse", "Screen")

logPath := A_Args.Length >= 1 ? A_Args[1] : "ahk.log"


ClickWithMarker(x, y, button := "Left") {
    Click(x, y, button)

    Sleep(10)
    ToolTip(Format("Clicking at {1}, {2}", x, y))
    size := 20
    g := Gui("-Caption +AlwaysOnTop +ToolWindow")
    g.BackColor := "Red"
    g.Show(Format(
        "x{} y{} w{} h{} NoActivate"
        , x - size // 2
        , y - size // 2
        , size
        , size
    ))
    hRegion := DllCall(
        "CreateEllipticRgn"
        , "Int", 0
        , "Int", 0
        , "Int", size
        , "Int", size
        , "Ptr"
    )
    DllCall("SetWindowRgn", "Ptr", g.Hwnd, "Ptr", hRegion, "Int", true)
    WinSetTransparent(255, g.Hwnd)
    SetTimer(() => g.Destroy(), -500)
}


ClickCenterOfImageInWindow(winTitle, imageFile, timeoutMs := 10000, intervalMs := 250)
{
    WinGetPos(&wx, &wy, &ww, &wh, winTitle)

    img := LoadPicture(imageFile, , &imgType)
    width := img.W
    height := img.H

    startTime := A_TickCount

    timeLeft := timeoutMs - (A_TickCount - startTime)
    while (timeLeft > 0)
    {
        try
        {
            if ImageSearch(&x, &y, wx, wy, wx + ww, wy + wh, imageFile)
            {
                ClickWithMarker(x + Floor(width / 2), y + Floor(height / 2))
                return
            }
        }

        Sleep intervalMs
        timeLeft := timeoutMs - (A_TickCount - startTime)
        ToolTip(Format("Searching for button {} in window {}...  {}s left", imageFile, winTitle, timeLeft / 1000))
    }

    throw Error("failed to find button in window.")
}


ToolTip("Waiting for the installer window to appear...")
winTitle := "Hermes"
try {
    WinWait(winTitle, , 30)
} catch {
    FileAppend("ERROR: Hermes installer window did not appear within 30s`n", logPath)
    ExitApp(1)
}
WinGetPos(&x, &y, &w, &h, winTitle)
FileAppend(Format("Window found at x={1} y={2} w={3} h={4}`n", x, y, w, h), logPath)
ToolTip(Format("Installer window appeared at x={1} y={2} w={3} h={4}. Sleeping for a few seconds.....", x, y, w, h))

ClickCenterOfImageInWindow(winTitle, "install-button.png")

Sleep(10000)
ClickCenterOfImageInWindow(winTitle, "install-button.png", 60 * 60 * 20)


; done
ExitApp(0)