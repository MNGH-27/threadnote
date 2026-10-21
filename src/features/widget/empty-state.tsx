import type { ReactNode } from "react";

export function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="grid min-h-32 place-items-center px-5 py-7 text-center">
      <div>
        <div className="mx-auto mb-2 grid size-10 place-items-center rounded-2xl bg-white/[.05] text-zinc-500">
          {icon}
        </div>
        <p className="text-xs font-medium text-zinc-300">{title}</p>
        <p className="mt-1 text-[10px] leading-5 text-zinc-600">{text}</p>
      </div>
    </div>
  );
}
