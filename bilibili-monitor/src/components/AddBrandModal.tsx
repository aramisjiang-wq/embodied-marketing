"use client";

import { useState } from "react";
import { X, Search, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface AddBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mid: string, name: string) => Promise<void>;
}

type Step = "input" | "validating" | "success" | "error";

export function AddBrandModal({ isOpen, onClose, onAdd }: AddBrandModalProps) {
  const [mid, setMid] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [validatedMid, setValidatedMid] = useState("");

  const handleClose = () => {
    setMid("");
    setName("");
    setStep("input");
    setErrorMsg("");
    setValidatedMid("");
    onClose();
  };

  const handleValidate = async () => {
    if (!mid.trim()) return;

    setStep("validating");
    setErrorMsg("");

    try {
      const response = await fetch(`/api/brands/validate?mid=${encodeURIComponent(mid.trim())}`);
      const data = await response.json();

      if (data.success && data.data) {
        setValidatedMid(data.data.mid);
        if (data.data.name) {
          setName(data.data.name);
        }
        setStep("success");
      } else {
        setErrorMsg(data.error || "验证失败");
        setStep("error");
      }
    } catch {
      setErrorMsg("网络错误，请重试");
      setStep("error");
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      setErrorMsg("请输入品牌名称");
      setStep("error");
      return;
    }
    try {
      await onAdd(validatedMid || mid.trim(), name.trim());
      handleClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "添加失败");
      setStep("error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">添加品牌</h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* MID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              B站 MID 或主页链接
            </label>
            <div className="relative">
              <input
                type="text"
                value={mid}
                onChange={(e) => setMid(e.target.value)}
                onFocus={() => step === "error" && setStep("input")}
                placeholder="521974986 或 space.bilibili.com/..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                disabled={step === "validating"}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              在B站UP主主页URL中找到数字ID
            </p>
          </div>

          {/* Name Input - show after validation */}
          {(step === "success" || step === "error") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                品牌名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入品牌/公司名称"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>
          )}

          {/* Success State */}
          {step === "success" && (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">MID 验证通过</p>
                <p className="text-sm text-gray-600 mt-1">
                  ID: {validatedMid} · 请输入品牌名称后确认添加
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === "error" && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">提示</p>
                <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Validating State */}
          {step === "validating" && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              <p className="text-gray-600">正在验证...</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            取消
          </button>
          {step === "input" && (
            <button
              onClick={handleValidate}
              disabled={!mid.trim()}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors text-sm font-medium"
            >
              <Search className="w-4 h-4" />
              验证
            </button>
          )}
          {step === "success" && (
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              确认添加
            </button>
          )}
          {step === "error" && (
            <button
              onClick={() => {
                if (errorMsg.includes("名称")) {
                  setStep("success");
                } else {
                  setStep("input");
                }
              }}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
