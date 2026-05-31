export const controlToolbar = "rounded-full p-1 items-center flex gap-0.5 backdrop-blur-[10px] hover:z-[100]";

export const controlToolbarStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.56)",
  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)",
  boxShadow: [
    "0px 40px 24px 0px rgba(0,0,0,0.06)", "0px 23px 14px 0px rgba(0,0,0,0.08)",
    "0px 10px 10px 0px rgba(0,0,0,0.12)", "0px 3px 6px 0px rgba(0,0,0,0.19)",
    "0px 0px 0px 0.75px rgba(0,0,0,0.56)",
    "inset 0px -12px 16px 0px rgba(255,255,255,0.06)", "inset 0px 4px 16px 0px rgba(255,255,255,0.16)",
    "inset 0px 0.75px 0.25px 0px rgba(255,255,255,0.12)", "inset 0px 0.25px 0.25px 0px rgba(255,255,255,0.32)",
  ].join(", "),
};

export const controlBtn = "size-8 hover:bg-white/10 flex items-center text-white duration-200 active:scale-95 justify-center cursor-pointer rounded-full";
