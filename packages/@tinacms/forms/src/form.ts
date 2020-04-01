/**

Copyright 2019 Forestry.io Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

import arrayMutators from 'final-form-arrays'
import { FormApi, createForm, Config, Unsubscribe } from 'final-form'
import { Plugin } from '@tinacms/core'

export interface FormOptions<S> extends Config<S> {
  id: any
  label: string
  fields: Field[]
  __type?: string
  reset?(): void
  actions?: any[]
  meta?: {
    [key: string]: string
  }
  loadInitialValues?: () => Promise<S>
}

export interface Field {
  name: string
  label?: string
  description?: string
  component: React.FC<any> | string | null
  parse?: (value: any, name: string, field: Field) => any
  format?: (value: any, name: string, field: Field) => any
  validate?(
    value: any,
    allValues: any,
    meta: any,
    field: Field
  ): string | object | undefined
  defaultValue?: any
  fields?: Field[]
}

interface FieldSubscription {
  path: string
  field: Field
  unsubscribe: Unsubscribe
}

export class Form<S = any> implements Plugin {
  private _reset?(): void

  __type: string
  id: any
  label: string
  fields: Field[]
  finalForm: FormApi<S>
  actions: any[]
  meta: { [key: string]: any }

  constructor({
    id,
    label,
    fields,
    actions,
    reset,
    loadInitialValues,
    ...options
  }: FormOptions<S>) {
    const initialValues = options.initialValues || ({} as S)
    this.__type = options.__type || 'form'
    this.id = id
    this.label = label
    this.fields = fields
    this.finalForm = createForm<S>({
      ...options,
      initialValues,
      async onSubmit(values, form, cb) {
        const response = await options.onSubmit(values, form, cb)
        form.initialize(values)
        return response
      },
      mutators: {
        /**
         * TODO: Broken by `final-form@4.18.6`.
         *
         * Left comment in the docs
         *
         * https://github.com/final-form/final-form/pull/275#issuecomment-551132760
         */
        ...(arrayMutators as any),
        ...options.mutators,
      },
    })

    this.meta = options.meta || {}
    this._reset = reset
    this.actions = actions || []
    this.updateFields(this.fields)

    if (loadInitialValues) {
      loadInitialValues().then(initialValues => {
        this.updateInitialValues(initialValues)
      })
    }
  }

  async reset() {
    if (this._reset) {
      await this._reset()
    }
    this.finalForm.reset()
  }

  updateFields(fields: Field[]) {
    this.fields = fields
  }

  change(name: string, value?: any) {
    return this.finalForm.change(name, value)
  }

  get initialValues() {
    return this.finalForm.getState().initialValues
  }

  subscribe: FormApi<S>['subscribe'] = (cb, options) => {
    return this.finalForm.subscribe(cb, options)
  }

  submit: FormApi<S>['submit'] = () => {
    return this.finalForm.submit()
  }

  get mutators() {
    return this.finalForm.mutators
  }

  get values() {
    return this.finalForm.getState().values
  }

  get name() {
    return this.id
  }

  updateValues(values: S) {
    this.finalForm.batch(() => {
      const activePath: string | undefined = this.finalForm.getState().active

      if (!activePath) {
        updateEverything(this.finalForm, values)
      } else {
        updateSelectively(this.finalForm, values)
      }
    })
  }

  updateInitialValues(initialValues: S) {
    this.finalForm.batch(() => {
      const values = this.values
      this.finalForm.initialize(initialValues)
      const activePath: string | undefined = this.finalForm.getState().active

      if (!activePath) {
        updateEverything(this.finalForm, values)
      } else {
        updateSelectively(this.finalForm, values)
      }
    })
  }
}

function updateEverything(form: FormApi<any>, values: any) {
  Object.entries(values).forEach(([path, value]) => {
    form.change(path, value)
  })
}

function updateSelectively(form: FormApi<any>, values: any, prefix?: string) {
  const activePath: string = form.getState().active!

  Object.entries(values).forEach(([name, value]) => {
    const path = prefix ? `${prefix}.${name}` : name

    if (typeof value === 'object') {
      if (activePath.startsWith(path)) {
        updateSelectively(form, value, path)
      } else {
        form.change(path, value)
      }
    } else if (path !== activePath) {
      form.change(path, value)
    }
  })
}
