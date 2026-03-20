import type React from "react";

import styles from "./studio-equipment.module.css";

// ── Private Constants ──

const EQUIPMENT_CATEGORIES: readonly {
  category: string;
  items: readonly string[];
}[] = [
  {
    category: "Microphones",
    items: ["Condenser microphones", "Dynamic microphones", "Ribbon microphones"],
  },
  {
    category: "Recording",
    items: ["Multi-track interface", "Studio monitors", "Headphone distribution"],
  },
  {
    category: "Backline",
    items: ["Drum kit", "Bass amp", "Guitar amps", "Keyboard"],
  },
  {
    category: "PA & Live",
    items: ["PA system", "Stage monitors", "Basic lighting rig"],
  },
];

// ── Public API ──

export function StudioEquipment(): React.ReactElement {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Equipment</h2>
      <div className={styles.grid}>
        {EQUIPMENT_CATEGORIES.map((cat) => (
          <div key={cat.category} className={styles.category}>
            <h3 className={styles.categoryHeading}>{cat.category}</h3>
            <ul className={styles.items}>
              {cat.items.map((item) => (
                <li key={item} className={styles.item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
