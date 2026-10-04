@echo off
setlocal
rem Locate vcvars64.bat across VS 2022 editions (Enterprise/Professional/Community/BuildTools)
for %%E in (Enterprise Professional Community BuildTools) do (
  if not defined VCVARS if exist "C:\Program Files\Microsoft Visual Studio\2022\%%E\VC\Auxiliary\Build\vcvars64.bat" (
    set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\%%E\VC\Auxiliary\Build\vcvars64.bat"
  )
)
if defined VCVARS (
  call "%VCVARS%"
) else (
  echo [tauri-dev] vcvars64.bat not found - continuing with the current environment.
)
npx tauri dev
