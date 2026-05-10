"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Shield, AlertCircle, Loader2, ExternalLink } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(error);

  useEffect(() => {
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    console.log("[Login] Initializing direct redirect flow...");

    const initLogin = async () => {
      try {
        const response = await fetch("/api/auth/feishu");
        const data = await response.json();

        console.log("[Login] API response:", data);

        if (!data.success) {
          throw new Error(data.error || "Failed to get auth URL");
        }

        setAuthUrl(data.data.auth_url);
        console.log("[Login] Auth URL received:", data.data.auth_url);
        setLoading(false);
      } catch (err) {
        console.error("[Login] Error:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Initialization failed"
        );
        setLoading(false);
      }
    };

    initLogin();
  }, []);

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

          {/* Login Section */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div className="w-full flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500">正在准备登录...</p>
              </div>
            ) : errorMessage ? (
              <div className="w-full flex flex-col items-center justify-center py-12 bg-red-50 rounded-xl border border-red-200 px-6">
                <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                <p className="text-sm text-red-600 text-center font-medium mb-1">
                  登录失败
                </p>
                <p className="text-xs text-red-400 text-center mb-4">
                  {errorMessage}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors btn"
                >
                  重试
                </button>
              </div>
            ) : (
              <div className="w-full space-y-4">
                {/* Main Login Button */}
                {authUrl && (
                  <a
                    href={authUrl}
                    className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-blue-500 text-white rounded-xl text-base font-medium hover:bg-blue-600 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18 2h-3a5 5 0 00-5 5v3H7a4 4 0 00-4 4v10a4 4 0 004 4h10a4 4 0 004-4v-3a5 5 0 00-5-5h-3M8 12h8" />
                    </svg>
                    使用飞书账号登录
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Instructions */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>点击上方按钮跳转到飞书授权页面</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>在飞书中确认授权登录</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>授权后自动跳转回监控系统</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-400 fade-in">
          <p>Powered by LimX Dynamics · 飞书安全认证</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
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
            <div className="bg-white rounded-2xl shadow-xl p-8 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
