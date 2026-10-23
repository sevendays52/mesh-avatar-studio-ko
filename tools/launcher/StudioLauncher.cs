using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        string root = AppDomain.CurrentDomain.BaseDirectory;
        bool smoke = Array.IndexOf(args, "--smoke-test") >= 0;
        if (!File.Exists(Path.Combine(root, "tools", "start-studio.mjs")))
        {
            MessageBox.Show("실행파일을 Mesh Avatar Studio 저장소 폴더 안에 두세요.\nKeep this launcher inside the Studio repository.", "Mesh Avatar Studio");
            return;
        }
        string identity;
        using (var sha = SHA256.Create()) identity = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-", "");
        bool created;
        using (var mutex = new Mutex(true, "Local\\MeshAvatarStudio_" + identity, out created))
        {
            if (!created)
            {
                try
                {
                    string record = File.ReadAllText(Path.Combine(root, "work", "studio-launcher.json"));
                    var match = Regex.Match(record, @"http://127\.0\.0\.1:\d+/\?projects=1&lang=ko");
                    if (match.Success) { if (!smoke) Process.Start(new ProcessStartInfo(match.Value) { UseShellExecute = true }); return; }
                }
                catch { }
                MessageBox.Show("Studio가 이미 실행 중이거나 시작 중입니다.\nStudio is already running or starting.", "Mesh Avatar Studio");
                return;
            }
            Application.Run(new LauncherWindow(root, smoke));
        }
    }
}

internal sealed class LauncherWindow : Form
{
    private readonly string root;
    private readonly bool smokeTest;
    private readonly Label status = new Label();
    private readonly TextBox log = new TextBox();
    private readonly Button open = new Button();
    private Process server;
    private string url;
    private bool closing;

    internal LauncherWindow(string folder, bool smoke)
    {
        root = folder; smokeTest = smoke;
        Text = "Mesh Avatar Studio KO"; ClientSize = new Size(590, 330);
        StartPosition = FormStartPosition.CenterScreen; MinimumSize = new Size(550, 340);
        Font = new Font("Segoe UI", 10); BackColor = Color.FromArgb(245, 247, 251);
        status.Text = "Studio를 시작합니다 / Starting Studio…";
        status.SetBounds(22, 20, 540, 50); status.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        log.Multiline = true; log.ReadOnly = true; log.ScrollBars = ScrollBars.Vertical;
        log.SetBounds(22, 75, 546, 170); log.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        open.Text = "브라우저 열기 / Open browser"; open.Enabled = false;
        open.SetBounds(22, 263, 270, 42); open.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
        open.Click += delegate { OpenBrowser(); };
        var stop = new Button { Text = "종료 / Stop Studio" };
        stop.SetBounds(308, 263, 260, 42); stop.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;
        stop.Click += delegate { Close(); };
        Controls.AddRange(new Control[] { status, log, open, stop });
        Shown += delegate { StartServer(); };
        FormClosing += delegate { StopServer(); };
    }

    private void StartServer()
    {
        try
        {
            string bundled = Path.Combine(root, "tools", "launcher-runtime", "node.exe");
            var start = new ProcessStartInfo(File.Exists(bundled) ? bundled : "node.exe", "\"" + Path.Combine(root, "tools", "start-studio.mjs") + "\"");
            start.WorkingDirectory = root; start.UseShellExecute = false; start.CreateNoWindow = true;
            start.RedirectStandardOutput = true; start.RedirectStandardError = true; start.RedirectStandardInput = true;
            start.StandardOutputEncoding = Encoding.UTF8; start.StandardErrorEncoding = Encoding.UTF8;
            start.EnvironmentVariables["STUDIO_LAUNCHER"] = "1";
            server = new Process { StartInfo = start, EnableRaisingEvents = true };
            server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { Receive(e.Data); };
            server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { Receive(e.Data); };
            server.Exited += delegate { UpdateUI(delegate { if (!closing) { status.Text = "Studio가 종료됐습니다. 아래 내용을 확인하세요. / Studio stopped."; open.Enabled = false; if (smokeTest) Close(); } }); };
            server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine();
        }
        catch (Exception error)
        {
            status.Text = "실행 환경을 찾지 못했습니다 / Cannot start Studio";
            log.Text = error.Message + "\r\nRebuild with tools/build-launcher.ps1, or install Node.js 22.17+.";
            if (smokeTest) { Environment.ExitCode = 1; Close(); }
        }
    }

    private void Receive(string line)
    {
        if (line == null) return;
        UpdateUI(delegate {
            log.AppendText(line + Environment.NewLine);
            if (line.StartsWith("STUDIO_READY ", StringComparison.Ordinal))
            {
                url = line.Substring("STUDIO_READY ".Length); open.Enabled = true;
                status.Text = "Studio 실행 중 · 이 창을 닫으면 서버가 종료됩니다.\nStudio is running. Keep this window open while editing or streaming.";
                if (smokeTest)
                {
                    File.WriteAllText(Path.Combine(root, "work", "launcher-smoke.txt"), url);
                    string review = Path.Combine(root, "projects", ".fork-review");
                    Directory.CreateDirectory(review);
                    using (var picture = new Bitmap(Width, Height))
                    {
                        DrawToBitmap(picture, new Rectangle(0, 0, Width, Height));
                        picture.Save(Path.Combine(review, "launcher.png"), System.Drawing.Imaging.ImageFormat.Png);
                    }
                    var timer = new System.Windows.Forms.Timer { Interval = 1500 };
                    timer.Tick += delegate { timer.Stop(); timer.Dispose(); Close(); }; timer.Start();
                }
                else OpenBrowser();
            }
        });
    }
    private void UpdateUI(Action action)
    {
        if (closing || IsDisposed || !IsHandleCreated) return;
        try { BeginInvoke(action); } catch (InvalidOperationException) { }
    }
    private void OpenBrowser()
    {
        try { if (url != null) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception error) { log.AppendText(error.Message + Environment.NewLine + url); }
    }
    private void StopServer()
    {
        closing = true;
        if (server == null) return;
        try
        {
            if (!server.HasExited)
            {
                server.StandardInput.WriteLine("stop"); server.StandardInput.Flush(); server.StandardInput.Close();
                if (!server.WaitForExit(4000))
                {
                    using (var kill = Process.Start(new ProcessStartInfo("taskkill.exe", "/PID " + server.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true })) kill.WaitForExit(4000);
                }
            }
        }
        catch (InvalidOperationException) { }
        catch (IOException) { }
        finally { server.Dispose(); }
    }
}
