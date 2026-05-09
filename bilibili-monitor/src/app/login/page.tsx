"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Shield, QrCode, AlertCircle, Loader2 } from "lucide-react";

declare global {
  interface Window {
    QRLogin: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(error);
  const [sdkTimeout, setSdkTimeout] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    const initFeishuLogin = async () => {
      try {
        const response = await fetch("/api/auth/feishu");
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to get auth URL");
        }

        setAuthUrl(data.data.auth_url);

        // 设置8秒超时，超时后显示备用登录按钮
        const timeoutId = setTimeout(() => {
          setSdkTimeout(true);
          setLoading(false);
        }, 8000);

        if (!window.QRLogin) {
          const script = document.createElement("script");
          script.src =
            "https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js";
          script.async = true;

          script.onload = () => {
            clearTimeout(timeoutId);
            renderQRCode(data.data.auth_url);
          };

          script.onerror = () => {
            clearTimeout(timeoutId);
            setSdkTimeout(true);
            setLoading(false);
          };

          document.head.appendChild(script);
        } else {
          clearTimeout(timeoutId);
          renderQRCode(data.data.auth_url);
        }
      } catch (err) {
        console.error("Failed to initialize Feishu login:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Initialization failed"
        );
        setLoading(false);
      }
    };

    initFeishuLogin();
  }, []);

  const renderQRCode = (goto: string) => {
    if (!qrContainerRef.current || !window.QRLogin) return;

    try {
      window.QRLogin({
        id: "feishu-qrcode-container",
        goto: goto,
        width: 280,
        height: 280,
        style: "border:none",
      });

      setLoading(false);
      setScanStatus("scanning");

      const messageHandler = (event: MessageEvent) => {
        if (
          !window.QRLogin?.matchOrigin(event.origin) ||
          !window.QRLogin?.matchData(event.data)
        ) {
          return;
        }

        const tmpCode = event.data.tmp_code;
        if (tmpCode) {
          setScanStatus("success");

          setTimeout(() => {
            const redirectUrl = `${goto}&tmp_code=${tmpCode}`;
            window.location.href = redirectUrl;
          }, 500);
        }
      };

      window.addEventListener("message", messageHandler);

      return () => {
        window.removeEventListener("message", messageHandler);
      };
    } catch (err) {
      console.error("Failed to render QR code:", err);
      setErrorMessage("Failed to render QR code");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8 fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Image
              src="/logo.png"
              alt="LimX Marketing"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            LimX Marketing
          </h1>
          <p className="text-sm text-gray-500">B站竞品监控系统</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 card-elevated fade-in">
          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-gray-500">
              安全登录 · 飞书账号授权
            </span>
          </div>

          {/* QR Code Section */}
          <div className="flex flex-col items-center">
            {loading && !sdkTimeout ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-3" />
                <p className="text-xs text-gray-400">正在加载飞书二维码...</p>
              </div>
            ) : errorMessage ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-red-50 rounded-xl border border-red-200 p-6">
                <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                <p className="text-sm text-red-600 text-center font-medium">
                  登录失败
                </p>
                <p className="text-xs text-red-400 text-center mt-1">
                  {errorMessage}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors btn"
                >
                  重试
                </button>
              </div>
            ) : sdkTimeout ? (
              <div className="w-[280px] h-[280px] flex flex-col items-center justify-center bg-blue-50 rounded-xl border border-blue-200 p-6">
                <QrCode className="w-12 h-12 text-blue-400 mb-3" />
                <p className="text-sm text-blue-600 text-center font-medium mb-2">
                  二维码加载超时
                </p>
                <p className="text-xs text-blue-400 text-center mb-4">
                  请使用下方按钮手动登录
                </p>
                {authUrl && (
                  <a
                    href={authUrl}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors btn"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 2h-3a5 5 0 00-5 5v3H7a4 4 0 00-4 4v10a4 4 0 004 4h10a4 4 0 004-4v-3a5 5 0 00-5-5h-3M8 12h8"/>
                    </svg>
                    点击跳转飞书登录
                  </a>
                )}
              </div>
            ) : (
              <>
                <div
                  ref={qrContainerRef}
                  id="feishu-qrcode-container"
                  className="rounded-xl overflow-hidden shadow-inner bg-white"
                />

                {/* Scan Status */}
                <div className="mt-4 flex items-center gap-2">
                  {scanStatus === "scanning" && (
                    <>
                      <QrCode className="w-4 h-4 text-blue-500 animate-pulse" />
                      <span className="text-xs text-gray-600">
                        请使用飞书 App 扫码登录
                      </span>
                    </>
                  )}
                  {scanStatus === "success" && (
                    <>
                      <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-600 font-medium">
                        扫码成功，正在跳转...
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Help Text */}
          {!loading && !errorMessage && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>打开飞书 App，扫描上方二维码</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>在手机上确认授权登录</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>授权后自动跳转到监控系统</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-400 fade-in">
          <p>Powered by LimX Dynamics · 飞书安全认证</p>
        </div>
      </div>
    </div>
  );
}
