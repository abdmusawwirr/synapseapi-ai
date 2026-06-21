"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";

import { PricingCard } from "../components/pricing-card";

const fallbackProducts = [
  {
    id: "monthly",
    name: "Monthly",
    description: "For teams getting started",
    metadata: {
      variant: "default",
      badge: null,
    },
    prices: [
      {
        amountType: "fixed",
        priceAmount: 2900,
        recurringInterval: "month",
      },
    ],
    benefits: [
      { description: "Unlimited meetings" },
      { description: "Unlimited transcripts" },
      { description: "Unlimited recording storage" },
      { description: "Unlimited agents" },
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    description: "For teams that need to scale",
    metadata: {
      variant: "highlighted",
      badge: "Best Value",
    },
    prices: [
      {
        amountType: "fixed",
        priceAmount: 25900,
        recurringInterval: "year",
      },
    ],
    benefits: [
      { description: "Unlimited agents" },
      { description: "Unlimited recording storage" },
      { description: "Unlimited transcripts" },
      { description: "Unlimited meetings" },
      { description: "2 months free" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For teams with special requests",
    metadata: {
      variant: "default",
      badge: null,
    },
    prices: [
      {
        amountType: "fixed",
        priceAmount: 99900,
        recurringInterval: "year",
      },
    ],
    benefits: [
      { description: "Unlimited agents" },
      { description: "Unlimited recording storage" },
      { description: "Unlimited transcripts" },
      { description: "Unlimited meetings" },
      { description: "Dedicated Discord support" },
    ],
  },
];

export const UpgradeView = () => {
  const trpc = useTRPC();

  const { data: products } = useSuspenseQuery(
    trpc.premium.getProducts.queryOptions()
  );

  const { data: currentSubscription } = useSuspenseQuery(
    trpc.premium.getCurrentSubscription.queryOptions()
  );

  const displayProducts = products.length > 0 ? products : fallbackProducts;

  return (
    <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-10">
      <div className="mt-4 flex-1 flex flex-col gap-y-10 items-center">
        <h5 className="font-medium text-2xl md:text-3xl">
          You are on the{" "}
          <span className="font-semibold text-primary">
            {currentSubscription?.name ?? "Free"}
          </span>{" "}
          plan
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
          {displayProducts.map((product) => {
            const isCurrentProduct = currentSubscription?.id === product.id;
            const isPremium = !!currentSubscription;
            const canCheckout = products.some(({ id }) => id === product.id);

            let buttonText = "Upgrade";
            let onClick = canCheckout
              ? () => authClient.checkout({ products: [product.id] })
              : () => {};

            if (isCurrentProduct) {
              buttonText = "Manage";
              onClick = () => authClient.customer.portal();
            } else if (isPremium) {
              buttonText = "Change Plan";
              onClick = () => authClient.customer.portal();
            }

            return (
              <PricingCard
                key={product.id}
                buttonText={buttonText}
                onClick={onClick}
                variant={
                  product.metadata.variant === "highlighted"
                    ? "highlighted"
                    : "default"
                }
                title={product.name}
                price={
                  (() => {
                    const p = product.prices[0];
                    if (!p) return 0;
                    return p.amountType === "fixed" ? p.priceAmount / 100 : 0;
                  })()
                }
                description={product.description}
                priceSuffix={(() => {
                  const p = product.prices[0];
                  if (!p || !("recurringInterval" in p)) return "";
                  return `/${p.recurringInterval}`;
                })()}
                features={product.benefits.map(
                  (benefit) => benefit.description
                )}
                badge={product.metadata.badge as string | null}
              />
            )
          })}
        </div>
      </div>
    </div>
  );
};

export const UpgradeViewLoading = () => {
  return (
    <LoadingState title="Loading" description="This may take a few seconds" />
  );
};

export const UpgradeViewError = () => {
  return <ErrorState title="Error" description="Please try again later" />;
};
