import { useState } from "react";
import type React from "react";
import type { MerchProductDetail as MerchProductDetailType } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { formatPrice } from "../../lib/format.js";
import { navigateExternal } from "../../lib/url.js";
import { createMerchCheckout } from "../../lib/merch.js";
import { OptionalImage } from "../ui/optional-image.js";
import { VariantSelector } from "./variant-selector.js";
import buttonStyles from "../../styles/button.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import styles from "./product-detail.module.css";

// ── Public Types ──

export interface ProductDetailProps {
  readonly product: MerchProductDetailType;
}

// ── Private Helpers ──

function findFirstAvailable(
  variants: MerchProductDetailType["variants"],
): string {
  const available = variants.find((v) => v.available);
  return available ? available.id : variants[0]?.id ?? "";
}

// ── Public API ──

export function ProductDetail({
  product,
}: ProductDetailProps): React.ReactElement {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() =>
    findFirstAvailable(product.variants),
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId,
  );
  const displayPrice = selectedVariant?.price ?? product.price;
  const isUnavailable = selectedVariant !== undefined && !selectedVariant.available;

  const handleBuy = async (): Promise<void> => {
    if (isUnavailable || isCheckingOut) return;
    setIsCheckingOut(true);
    setError(null);
    try {
      const checkoutUrl = await createMerchCheckout(selectedVariantId, 1);
      navigateExternal(checkoutUrl);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Checkout failed. Please try again.";
      setError(message);
      setIsCheckingOut(false);
    }
  };

  return (
    <article className={styles.container}>
      {/* ── Image Gallery ── */}
      <div className={styles.gallery}>
        <div className={styles.mainImageWrapper}>
          <OptionalImage
            src={product.images.length > 0 ? product.images[selectedImageIndex]?.url : null}
            alt={product.images[selectedImageIndex]?.altText ?? product.title}
            className={styles.mainImage}
            placeholderClassName={styles.imagePlaceholder}
          />
        </div>

        {product.images.length > 1 && (
          <div className={styles.thumbnails} role="list" aria-label="Product images">
            {product.images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                role="listitem"
                className={
                  index === selectedImageIndex
                    ? `${styles.thumbnail} ${styles.thumbnailSelected}`
                    : styles.thumbnail
                }
                onClick={() => setSelectedImageIndex(index)}
                aria-label={image.altText ?? `Product image ${index + 1}`}
              >
                <img
                  src={image.url}
                  alt=""
                  className={styles.thumbnailImage}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Details ── */}
      <div className={styles.details}>
        <h1 className={styles.title}>{product.title}</h1>

        <span className={styles.price}>{formatPrice(displayPrice)}</span>

        {product.creatorName && (
          <p className={styles.creator}>
            by{" "}
            {product.creatorId ? (
              <Link
                to="/creators/$creatorId"
                params={{ creatorId: product.creatorId }}
                className={styles.creatorLink}
              >
                {product.creatorName}
              </Link>
            ) : (
              product.creatorName
            )}
          </p>
        )}

        {product.variants.length > 1 && (
          <div className={styles.variantSection}>
            <VariantSelector
              variants={product.variants}
              selectedId={selectedVariantId}
              onSelect={setSelectedVariantId}
            />
          </div>
        )}

        <button
          type="button"
          className={`${buttonStyles.primaryButton} ${styles.buyButton}`}
          disabled={isUnavailable || isCheckingOut}
          onClick={() => void handleBuy()}
        >
          {isCheckingOut
            ? "Processing…"
            : `Buy — ${formatPrice(displayPrice)}`}
        </button>

        {error && (
          <p className={errorStyles.error} role="alert">{error}</p>
        )}

        <div className={styles.description}>
          {product.description.split("\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <Link to="/merch" className={styles.backLink}>
          ← Back to merch
        </Link>
      </div>
    </article>
  );
}
