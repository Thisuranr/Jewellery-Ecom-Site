import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { L10nInput } from "../components/l10n-input"
import { attributesApi, ProductValueBody } from "../lib/attributes-api"
import { describeError } from "../lib/error-code"
import { uniqueOptionHandle } from "../lib/handle"
import {
  AttributeOption,
  emptyL10n,
  fromL10nForm,
  L10nForm,
  ProductAttribute,
  toL10nForm,
} from "../lib/types"

const KEYWORDS_MAX = 500
const NOT_SET = "__none__"

type FieldState = {
  options: string[]
  number: string
  bool: "unset" | "yes" | "no"
  text: L10nForm
}

type FormState = Record<string, FieldState>

const stateOf = (attribute: ProductAttribute): FieldState => {
  const value = attribute.value
  return {
    options: value?.option_ids ?? [],
    number: value?.value_number != null ? String(value.value_number) : "",
    bool: value?.value_bool == null ? "unset" : value.value_bool ? "yes" : "no",
    text: value?.value_text ? toL10nForm(value.value_text) : emptyL10n(),
  }
}

const isFilled = (attribute: ProductAttribute, field: FieldState): boolean => {
  switch (attribute.type) {
    case "select":
    case "multiselect":
      return field.options.length > 0
    case "number":
      return field.number.trim() !== ""
    case "boolean":
      return field.bool !== "unset"
    default:
      return field.text.en.trim() !== ""
  }
}

/** "blouse_piece" -> "Blouse piece". */
const groupTitle = (handle: string | null) => {
  const text = (handle ?? "other").replace(/_/g, " ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type Built = { values: ProductValueBody[]; errors: string[] }

/** The request values from the form; an attribute with no value is left out, which clears it. */
const buildValues = (attributes: ProductAttribute[], form: FormState): Built => {
  const values: ProductValueBody[] = []
  const errors: string[] = []
  for (const attribute of attributes) {
    const field = form[attribute.id]
    if (!field || !isFilled(attribute, field)) {
      continue
    }
    switch (attribute.type) {
      case "select":
      case "multiselect":
        values.push({ attribute_id: attribute.id, option_ids: field.options })
        break
      case "number": {
        const number = Number(field.number)
        if (!Number.isFinite(number)) {
          errors.push(`${attribute.label.en} must be a number`)
        } else {
          values.push({ attribute_id: attribute.id, value_number: number })
        }
        break
      }
      case "boolean":
        values.push({ attribute_id: attribute.id, value_bool: field.bool === "yes" })
        break
      default:
        values.push({ attribute_id: attribute.id, value_text: fromL10nForm(field.text) })
    }
  }
  return { values, errors }
}

/**
 * "+ Add new option" for a select or multiselect attribute: staff type a label,
 * the option is created on the attribute through the admin options API, and the
 * parent selects it.
 */
const AddOptionControl = ({
  attribute,
  onAdded,
}: {
  attribute: ProductAttribute
  onAdded: (attribute: ProductAttribute["options"], created: AttributeOption) => void
}) => {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")

  const create = useMutation({
    mutationFn: () => {
      const text = label.trim()
      const handle = uniqueOptionHandle(
        text,
        attribute.options.map((option) => option.handle)
      )
      const rank = attribute.options.reduce((max, option) => Math.max(max, option.rank), -1) + 1
      return attributesApi.createOption(attribute.id, { handle, label: { en: text }, rank }).then((response) => ({
        options: response.attribute.options,
        handle,
      }))
    },
    onSuccess: ({ options, handle }) => {
      const created = options.find((option) => option.handle === handle)
      if (!created) {
        toast.error("The option was added but could not be found. Reload the page.")
        return
      }
      onAdded(options, created)
      toast.success(`Added "${created.label.en}"`)
      setLabel("")
      setOpen(false)
    },
    onError: (failure) => toast.error(describeError(failure)),
  })

  if (!open) {
    return (
      <Button type="button" size="small" variant="transparent" className="self-start" onClick={() => setOpen(true)}>
        + Add new option
      </Button>
    )
  }

  const submit = () => {
    if (label.trim() && !create.isPending) {
      create.mutate()
    }
  }

  return (
    <div className="flex items-center gap-x-2">
      <Input
        size="small"
        autoFocus
        aria-label={`New ${attribute.label.en ?? "attribute"} option`}
        placeholder="New option label"
        value={label}
        maxLength={100}
        onChange={(event) => setLabel(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            submit()
          }
        }}
      />
      <Button type="button" size="small" isLoading={create.isPending} disabled={!label.trim()} onClick={submit}>
        Add
      </Button>
      <Button
        type="button"
        size="small"
        variant="secondary"
        disabled={create.isPending}
        onClick={() => {
          setLabel("")
          setOpen(false)
        }}
      >
        Cancel
      </Button>
    </div>
  )
}

const AttributeField = ({
  attribute,
  field,
  onChange,
  onOptionAdded,
}: {
  attribute: ProductAttribute
  field: FieldState
  onChange: (next: FieldState) => void
  onOptionAdded: (options: ProductAttribute["options"], created: AttributeOption) => void
}) => {
  const inputId = `product-attribute-${attribute.id}`

  switch (attribute.type) {
    case "select":
      return (
        <div className="flex flex-col gap-y-2">
        <Select
          value={field.options[0] ?? NOT_SET}
          onValueChange={(value) => onChange({ ...field, options: value === NOT_SET ? [] : [value] })}
        >
          <Select.Trigger id={inputId}>
            <Select.Value placeholder="Not set" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={NOT_SET}>Not set</Select.Item>
            {attribute.options.map((option) => (
              <Select.Item key={option.id} value={option.id}>
                {option.label.en}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <AddOptionControl attribute={attribute} onAdded={onOptionAdded} />
        </div>
      )
    case "multiselect":
      return (
        <div className="flex flex-col gap-y-2">
        <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label={attribute.label.en ?? undefined}>
          {attribute.options.map((option) => (
            <div key={option.id} className="flex items-center gap-x-2">
              <Checkbox
                id={`${inputId}-${option.id}`}
                checked={field.options.includes(option.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...field,
                    options: checked
                      ? [...field.options, option.id]
                      : field.options.filter((id) => id !== option.id),
                  })
                }
              />
              <Label htmlFor={`${inputId}-${option.id}`} size="small">
                {option.label.en}
              </Label>
            </div>
          ))}
        </div>
        <AddOptionControl attribute={attribute} onAdded={onOptionAdded} />
        </div>
      )
    case "number":
      return (
        <div className="flex items-center gap-x-2">
          <Input
            id={inputId}
            type="number"
            step="any"
            min={0}
            value={field.number}
            onChange={(event) => onChange({ ...field, number: event.target.value })}
          />
          {attribute.unit && <Text className="text-ui-fg-subtle">{attribute.unit}</Text>}
        </div>
      )
    case "boolean":
      return (
        <Select
          value={field.bool}
          onValueChange={(value) => onChange({ ...field, bool: value as FieldState["bool"] })}
        >
          <Select.Trigger id={inputId}>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="unset">Not set</Select.Item>
            <Select.Item value="yes">Yes</Select.Item>
            <Select.Item value="no">No</Select.Item>
          </Select.Content>
        </Select>
      )
    default:
      return (
        <L10nInput
          label={attribute.label.en ?? "Text"}
          value={field.text}
          maxLength={500}
          multiline
          requiredEnglish={false}
          onChange={(text) => onChange({ ...field, text })}
        />
      )
  }
}

const ProductAttributesWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const queryKey = ["product-attributes", product.id]
  const { data, error, isPending } = useQuery({
    queryKey,
    queryFn: () => attributesApi.productAttributes(product.id),
  })

  const [form, setForm] = useState<FormState>({})
  const [keywords, setKeywords] = useState("")
  // Set while an added option refreshes the cached data, so the form (which may
  // hold unsaved edits) is not reset to the saved values.
  const keepForm = useRef(false)
  useEffect(() => {
    if (!data) {
      return
    }
    if (keepForm.current) {
      keepForm.current = false
      return
    }
    setForm(Object.fromEntries(data.attributes.map((attribute) => [attribute.id, stateOf(attribute)])))
    setKeywords(data.search_keywords)
  }, [data])

  const save = useMutation({
    mutationFn: (body: { values: ProductValueBody[]; search_keywords: string }) =>
      attributesApi.saveProductAttributes(product.id, body),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response)
      toast.success("Attributes saved")
    },
    onError: (failure) => toast.error(describeError(failure)),
  })

  /** Puts the attribute's refreshed option list into the cache and selects the new option. */
  const optionAdded = (
    attributeId: string,
    options: ProductAttribute["options"],
    created: AttributeOption
  ) => {
    keepForm.current = true
    queryClient.setQueryData<{ attributes: ProductAttribute[]; search_keywords: string }>(
      queryKey,
      (current) =>
        current && {
          ...current,
          attributes: current.attributes.map((attribute) =>
            attribute.id === attributeId ? { ...attribute, options } : attribute
          ),
        }
    )
    setForm((current) => {
      const field = current[attributeId]
      const definition = data?.attributes.find((attribute) => attribute.id === attributeId)
      if (!field) {
        return current
      }
      return {
        ...current,
        [attributeId]: {
          ...field,
          options: definition?.type === "multiselect" ? [...field.options, created.id] : [created.id],
        },
      }
    })
  }

  const attributes = data?.attributes ?? []
  const groups = useMemo(() => {
    const byGroup = new Map<string, ProductAttribute[]>()
    for (const attribute of attributes) {
      const key = attribute.group_handle ?? "other"
      byGroup.set(key, [...(byGroup.get(key) ?? []), attribute])
    }
    return [...byGroup.entries()]
  }, [attributes])

  const missing = attributes.filter(
    (attribute) => attribute.required && form[attribute.id] && !isFilled(attribute, form[attribute.id])
  )

  const submit = () => {
    const { values, errors } = buildValues(attributes, form)
    if (errors.length) {
      toast.error(errors.join(". "))
      return
    }
    save.mutate({ values, search_keywords: keywords })
  }

  const hasNoCategory = Array.isArray(product.categories) && product.categories.length === 0

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Product attributes</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Material, purity, metal colour, stone and the other facts shoppers filter and compare by.
          </Text>
        </div>
        {attributes.length > 0 && (
          <Button size="small" isLoading={save.isPending} onClick={submit}>
            Save
          </Button>
        )}
      </div>

      {error ? (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-error">{describeError(error)}</Text>
        </div>
      ) : isPending ? (
        <div className="px-6 py-4">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      ) : hasNoCategory ? (
        <div className="px-6 py-4">
          <Text>
            This product has no category yet. Add it to a category (for example Rings) in the
            Organize section, and its attributes appear here.
          </Text>
        </div>
      ) : attributes.length === 0 ? (
        <div className="px-6 py-4">
          <Text>
            No attributes are linked to this product&apos;s categories yet. Link them in{" "}
            <Link to="/settings/attributes" className="text-ui-fg-interactive">
              Settings &gt; Attributes
            </Link>
            .
          </Text>
        </div>
      ) : (
        <>
          {groups.map(([group, groupAttributes]) => (
            <div key={group} className="flex flex-col gap-y-4 px-6 py-4">
              <Heading level="h3">{groupTitle(group)}</Heading>
              {groupAttributes.map((attribute) => {
                const field = form[attribute.id]
                if (!field) {
                  return null
                }
                return (
                  <div
                    key={attribute.id}
                    className="grid grid-cols-1 items-start gap-2 md:grid-cols-[14rem_1fr]"
                  >
                    <div className="flex flex-col gap-y-1">
                      <Label htmlFor={`product-attribute-${attribute.id}`} size="small" weight="plus">
                        {attribute.label.en}
                        {attribute.required ? " *" : ""}
                      </Label>
                      {attribute.required && (
                        <Badge size="2xsmall" color="orange" className="self-start">
                          Required
                        </Badge>
                      )}
                    </div>
                    <AttributeField
                      attribute={attribute}
                      field={field}
                      onChange={(next) => setForm((current) => ({ ...current, [attribute.id]: next }))}
                      onOptionAdded={(options, created) => optionAdded(attribute.id, options, created)}
                    />
                  </div>
                )
              })}
            </div>
          ))}

          <div className="flex flex-col gap-y-2 px-6 py-4">
            <Label htmlFor="product-search-keywords" size="small" weight="plus">
              Search keywords
            </Label>
            <Textarea
              id="product-search-keywords"
              value={keywords}
              maxLength={KEYWORDS_MAX}
              rows={2}
              placeholder="Extra words shoppers might type, separated by commas"
              onChange={(event) => setKeywords(event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {keywords.length} / {KEYWORDS_MAX}. Saved on the product (metadata.search_keywords).
            </Text>
          </div>

          {missing.length > 0 && (
            <div className="px-6 py-3">
              <Text size="small" className="text-ui-fg-error">
                Required and not filled in: {missing.map((attribute) => attribute.label.en).join(", ")}
              </Text>
            </div>
          )}
        </>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductAttributesWidget
