import React from "react";
import {
  Card,
  BlockStack,
  Text,
  Select,
  Button,
  Banner,
} from "@shopify/polaris";

type Props = {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  locationOptions: {label: string; value: string}[];
  tagOptions: {label: string; value: string}[];
  errors: Record<string, string>;
  onBack: () => void;
  onSave: () => void;
};

export default function DefaultSettingsPopup({
  form,
  setForm,
  locationOptions,
  tagOptions,
  errors,
  onBack,
  onSave,
}: Props) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Rules Settings
        </Text>

        {/* Continue Selling */}
        <BlockStack>
          <Text as="span">Continue Selling When Out of Stock</Text>
          <Select
                      options={[
                          { label: "No (DENY)", value: "DENY" },
                          { label: "Yes (CONTINUE)", value: "CONTINUE" },
                      ]}
                      value={form.belowZero}
                      onChange={(v) => setForm((p: any) => ({ ...p, belowZero: v }))} label={undefined}          />
        </BlockStack>

        {/* Warehouse Locations */}
        <BlockStack>
          <Text as="span">Choose Warehouse Location</Text>
          <Select
                      options={[{ label: "Select", value: "" }, ...locationOptions]}
                      value={form.locationIds?.[0] ?? ""}
                      onChange={(v) => setForm((p: any) => ({ ...p, locationIds: v ? [v] : [] }))} label={undefined}          />
        </BlockStack>

        {/* Buffer Quantity */}
        <BlockStack>
          <Text as="span">Specify Buffer Quantity</Text>
          <Select
                      options={[
                          { label: "No", value: "no" },
                          { label: "Yes", value: "yes" },
                      ]}
                      value={form.bufferQuantity}
                      onChange={(v) => setForm((p: any) => ({ ...p, bufferQuantity: v }))} label={undefined}          />
          {form.bufferQuantity === "yes" && (
            <input
              type="text"
              value={form.inputBufferQuantity}
              onChange={(e) =>
                setForm((p: any) => ({
                  ...p,
                  inputBufferQuantity: e.target.value.replace(/\D+/g, ""),
                }))
              }
              style={{border: "1px solid #ccc", padding: "6px"}}
            />
          )}
          {errors.inputBufferQuantity && (
            <Banner tone="critical">{errors.inputBufferQuantity}</Banner>
          )}
        </BlockStack>

        {/* Expiry Date */}
        <BlockStack>
          <Text as="span">Expiry Date</Text>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) =>
              setForm((p: any) => ({...p, expiryDate: e.target.value}))
            }
            style={{border: "1px solid #ccc", padding: "6px"}}
          />
          {errors.expiryDate && (
            <Banner tone="critical">{errors.expiryDate}</Banner>
          )}
        </BlockStack>

        {/* Tag selection if rules = tag */}
        {form.selectionRules === "tag" && (
          <BlockStack>
            <Text as="span">Select Tag</Text>
            <Select
                          options={[{ label: "Select", value: "" }, ...tagOptions]}
                          value={form.singleTag}
                          onChange={(v) => setForm((p: any) => ({ ...p, singleTag: v, selectTag: [v] }))} label={undefined}            />
            {errors.selectTag && (
              <Banner tone="critical">{errors.selectTag}</Banner>
            )}
          </BlockStack>
        )}

        <BlockStack inlineAlign="end" gap="200">
          <Button onClick={onBack}>Back</Button>
          <Button variant="primary" onClick={onSave}>
            Save
          </Button>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
