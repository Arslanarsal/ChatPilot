import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator'

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && STRONG_PASSWORD.test(value)
  }

  defaultMessage(args: ValidationArguments): string {
    const v = typeof args.value === 'string' ? args.value : ''
    const missing: string[] = []
    if (v.length < 8) missing.push('at least 8 characters')
    if (!/[A-Z]/.test(v)) missing.push('an uppercase letter')
    if (!/[a-z]/.test(v)) missing.push('a lowercase letter')
    if (!/\d/.test(v)) missing.push('a number')
    if (!/[^A-Za-z0-9]/.test(v)) missing.push('a special character')
    return `Password must contain ${missing.join(', ')}`
  }
}

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    })
  }
}
